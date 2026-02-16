import { Await, Cell, If, getActiveRenderer, waitForAsyncBoundaries } from 'retend';
import { renderToString } from 'retend-server/client';
import type { VDOMRenderer, VWindow } from 'retend-server/v-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vDomSetup, timeout } from '../setup.tsx';

describe('Await Serialization', () => {
  vDomSetup();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should serialize resolved Await content, not the fallback', async () => {
    const asyncText = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Loaded';
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>{asyncText}</div>
      </Await>
    );

    const renderer = getActiveRenderer() as VDOMRenderer;
    const rendered = renderer.render(App);

    await vi.advanceTimersByTimeAsync(20);
    await waitForAsyncBoundaries();

    const result = renderToString(
      rendered,
      renderer.host as unknown as Parameters<typeof renderToString>[1]
    );
    expect(result).toContain('Loaded');
    expect(result).not.toContain('Loading');
  });

  it('should serialize all resolved async children', async () => {
    const first = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'First';
    });
    const second = Cell.derivedAsync(async () => {
      await timeout(25);
      return 'Second';
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          {first} {second}
        </div>
      </Await>
    );

    const renderer = getActiveRenderer() as VDOMRenderer;
    const rendered = renderer.render(App);

    await vi.advanceTimersByTimeAsync(30);
    await waitForAsyncBoundaries();

    const result = renderToString(
      rendered,
      renderer.host as unknown as Parameters<typeof renderToString>[1]
    );
    expect(result).toContain('First');
    expect(result).toContain('Second');
    expect(result).not.toContain('Loading');
  });

  it('should serialize nested Await boundaries', async () => {
    const outerText = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Outer';
    });
    const innerText = Cell.derivedAsync(async () => {
      await timeout(25);
      return 'Inner';
    });

    const App = () => (
      <Await fallback={<span>Outer Loading</span>}>
        <div>
          {outerText}{' '}
          <Await fallback={<span>Inner Loading</span>}>
            <span>{innerText}</span>
          </Await>
        </div>
      </Await>
    );

    const renderer = getActiveRenderer() as VDOMRenderer;
    const rendered = renderer.render(App);

    await vi.advanceTimersByTimeAsync(30);
    await waitForAsyncBoundaries();

    const result = renderToString(
      rendered,
      renderer.host as unknown as Parameters<typeof renderToString>[1]
    );
    expect(result).toContain('Outer');
    expect(result).toContain('Inner');
    expect(result).not.toContain('Loading');
  });

  it('should serialize async content from child components', async () => {
    const Child = () => {
      const data = Cell.derivedAsync(async () => {
        await timeout(15);
        return 'Child Data';
      });
      return <span>{data}</span>;
    };

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>
          <Child />
        </div>
      </Await>
    );

    const renderer = getActiveRenderer() as VDOMRenderer;
    const rendered = renderer.render(App);

    await vi.advanceTimersByTimeAsync(20);
    await waitForAsyncBoundaries();

    const result = renderToString(
      rendered,
      renderer.host as unknown as Parameters<typeof renderToString>[1]
    );
    expect(result).toContain('Child Data');
    expect(result).not.toContain('Loading');
  });

  it('should serialize when resolving an Await spawns another Await', async () => {
    const gate = Cell.derivedAsync(async () => {
      await timeout(10);
      return true;
    });

    const InnerContent = () => {
      const innerData = Cell.derivedAsync(async () => {
        await timeout(15);
        return 'Spawned';
      });
      return (
        <Await fallback={<span>Inner Loading</span>}>
          <span>{innerData}</span>
        </Await>
      );
    };

    const App = () => (
      <Await fallback={<span>Outer Loading</span>}>
        <div>
          {If(gate, {
            true: InnerContent,
            false: () => <span>Waiting</span>,
          })}
        </div>
      </Await>
    );

    const renderer = getActiveRenderer() as VDOMRenderer;
    const rendered = renderer.render(App);

    // Resolve both the outer gate and the inner async data.
    await vi.advanceTimersByTimeAsync(30);
    await waitForAsyncBoundaries();

    const result = renderToString(
      rendered,
      renderer.host as unknown as Parameters<typeof renderToString>[1]
    );
    expect(result).toContain('Spawned');
    expect(result).not.toContain('Loading');
    expect(result).not.toContain('Waiting');
  });

  it('should have no pending holders after all boundaries resolve', async () => {
    const asyncText = Cell.derivedAsync(async () => {
      await timeout(10);
      return 'Done';
    });

    const App = () => (
      <Await fallback={<span>Loading</span>}>
        <div>{asyncText}</div>
      </Await>
    );

    const renderer = getActiveRenderer() as VDOMRenderer;
    renderer.render(App);

    await vi.advanceTimersByTimeAsync(20);
    await waitForAsyncBoundaries();

    // waitForAsyncBoundaries should resolve immediately now
    const start = performance.now();
    await waitForAsyncBoundaries();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });
});
