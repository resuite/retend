import { Cell, For, getActiveRenderer } from 'retend';
import type { VElement, VNode } from 'retend-server/v-dom';
import type { DOMRenderer } from 'retend-web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type NodeLike,
  browserSetup,
  getTextContent,
  timeout,
  vDomSetup,
} from '../setup.tsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const runTests = () => {
  it('should render async list after resolution', async () => {
    const renderer = getActiveRenderer();
    const asyncItems = Cell.derivedAsync(async () => {
      await timeout(10);
      return ['A', 'B', 'C'];
    });

    const App = () => (
      <div>
        {For(asyncItems, (item) => (
          <span>{item}</span>
        ))}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    // Initially empty while pending
    expect(getTextContent(result)).toBe('');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('ABC');
  });

  it('should update when async list changes', async () => {
    const renderer = getActiveRenderer();
    const trigger = Cell.source(1);
    const asyncItems = Cell.derivedAsync(async (get) => {
      const val = get(trigger);
      await timeout(10);
      return val === 1 ? ['A', 'B'] : ['X', 'Y', 'Z'];
    });

    const App = () => (
      <div>
        {For(asyncItems, (item) => (
          <span>{item}</span>
        ))}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('AB');

    trigger.set(2);

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('XYZ');
  });

  it('should handle async list with complex objects', async () => {
    const renderer = getActiveRenderer();
    const asyncItems = Cell.derivedAsync(async () => {
      await timeout(10);
      return [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
    });

    const App = () => (
      <div>
        {For(asyncItems, (item) => (
          <span>{item.name}</span>
        ))}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('AliceBob');
  });

  it('should handle async list returning empty array', async () => {
    const renderer = getActiveRenderer();
    const asyncItems = Cell.derivedAsync(async () => {
      await timeout(10);
      return [];
    });

    const App = () => (
      <div>
        {For(asyncItems, (item) => (
          <span>{item}</span>
        ))}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('');
  });

  it('should handle async list with key option', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const trigger = Cell.source(1);

    const asyncItems = Cell.derivedAsync(async (get) => {
      const val = get(trigger);
      await timeout(10);
      return val === 1
        ? [
            { id: 1, name: 'First' },
            { id: 2, name: 'Second' },
          ]
        : [
            { id: 2, name: 'Second' },
            { id: 1, name: 'First' },
          ];
    });

    let callbackCount = 0;
    const App = () => (
      <div>
        {For(
          asyncItems,
          (item) => {
            callbackCount++;
            return <span data-id={item.id}>{item.name}</span>;
          },
          { key: 'id' }
        )}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('FirstSecond');
    expect(callbackCount).toBe(2);

    window.document.body.append(result as unknown as Node & VNode);
    const firstSpans = Array.from(
      (result as HTMLElement & VElement).querySelectorAll('span')
    );

    trigger.set(2);
    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('SecondFirst');
    // Keys should allow reuse
    const secondSpans = Array.from(
      (result as HTMLElement & VElement).querySelectorAll('span')
    );
    expect(firstSpans[0]).toBe(secondSpans[1]);
    expect(firstSpans[1]).toBe(secondSpans[0]);
  });
};

describe('Async For', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
