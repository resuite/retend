import { Cell, If, getActiveRenderer } from 'retend';
import type { VNode } from 'retend-server/v-dom';
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
  it('should render async truthy value after resolution', async () => {
    const renderer = getActiveRenderer();
    const asyncCondition = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const App = () => (
      <div>
        {If(
          asyncCondition,
          () => (
            <span>True</span>
          ),
          () => (
            <span>False</span>
          )
        )}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    // Initially empty while pending
    expect(getTextContent(result)).toBe('');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('True');
  });

  it('should render async falsy value after resolution', async () => {
    const renderer = getActiveRenderer();
    const asyncCondition = Cell.derivedAsync(async () => {
      await timeout(10);
      return false;
    });

    const App = () => (
      <div>
        {If(
          asyncCondition,
          () => (
            <span>True</span>
          ),
          () => (
            <span>False</span>
          )
        )}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('False');
  });

  it('should update when async condition changes', async () => {
    const renderer = getActiveRenderer();
    const trigger = Cell.source(true);
    const asyncCondition = Cell.derivedAsync(async (get) => {
      const val = get(trigger);
      await timeout(10);
      return val;
    });

    const App = () => (
      <div>
        {If(
          asyncCondition,
          () => (
            <span>True</span>
          ),
          () => (
            <span>False</span>
          )
        )}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('True');

    trigger.set(false);

    await vi.advanceTimersByTimeAsync(20);
    expect(getTextContent(result)).toBe('False');
  });

  it('should work with object syntax for branches', async () => {
    const renderer = getActiveRenderer();
    const asyncCondition = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const App = () => (
      <div>
        {If(asyncCondition, {
          true: () => <span>Yes</span>,
          false: () => <span>No</span>,
        })}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Yes');
  });

  it('should handle async condition with value passed to callback', async () => {
    const renderer = getActiveRenderer();
    const asyncData = Cell.derivedAsync(async () => {
      await timeout(10);
      return { name: 'Alice', age: 30 };
    });

    const App = () => (
      <div>
        {If(asyncData, (data) => (
          <span>
            {data.name} is {data.age}
          </span>
        ))}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    expect(getTextContent(result)).toBe('');

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('Alice is 30');
  });

  it('should handle async null value', async () => {
    const renderer = getActiveRenderer();
    const asyncCondition = Cell.derivedAsync(async () => {
      await timeout(10);
      return null;
    });

    const App = () => (
      <div>
        {If(
          asyncCondition,
          () => (
            <span>Has Value</span>
          ),
          () => (
            <span>No Value</span>
          )
        )}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    await vi.advanceTimersByTimeAsync(20);

    expect(getTextContent(result)).toBe('No Value');
  });

  it('should handle nested async If statements', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const outer = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const inner = Cell.derivedAsync(async () => {
      await timeout(15);
      return true;
    });

    const App = () => (
      <div>
        {If(outer, () =>
          If(
            inner,
            () => <span>Both True</span>,
            () => <span>Outer True, Inner False</span>
          )
        )}
      </div>
    );
    const result = renderer.render(App) as NodeLike;

    window.document.body.append(result as Node & VNode);

    expect(getTextContent(result)).toBe('');

    await vi.advanceTimersByTimeAsync(25);

    expect(getTextContent(result)).toBe('Both True');
  });
};

describe('Async If', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
