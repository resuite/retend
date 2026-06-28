import type { DOMRenderer } from 'retend-web';

import { Cell, getActiveRenderer } from 'retend';
import { describe, expect, it, vi } from 'vitest';

import { useResizeObserver } from '../../packages/retend-utils/source/hooks/use-resize-observer.js';
import { browserSetup } from '../setup.tsx';

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];

  callback: ResizeObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TestResizeObserver.instances.push(this);
  }
}

describe('useResizeObserver', () => {
  browserSetup();

  it('observes connected elements and disconnects after cleanup', () => {
    TestResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', TestResizeObserver);

    const renderer = getActiveRenderer() as DOMRenderer;
    const elementRef = Cell.source<HTMLElement | null>(null);
    const callback = vi.fn();
    const options = { box: 'border-box' as ResizeObserverBoxOptions };

    useResizeObserver(elementRef, callback, () => options);

    const element = renderer.render(
      <div ref={elementRef}>Resize me</div>
    ) as HTMLElement;

    renderer.host.document.body.append(element);
    renderer.observer?.flush();

    expect(TestResizeObserver.instances).toHaveLength(1);
    expect(TestResizeObserver.instances[0].callback).toBe(callback);
    expect(TestResizeObserver.instances[0].observe).toHaveBeenCalledWith(
      element,
      options
    );

    element.remove();
    renderer.observer?.flush();

    expect(TestResizeObserver.instances[0].unobserve).toHaveBeenCalledWith(
      element
    );
    expect(TestResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('shares one observer across multiple targets', () => {
    TestResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', TestResizeObserver);

    const renderer = getActiveRenderer() as DOMRenderer;
    const firstRef = Cell.source<HTMLElement | null>(null);
    const secondRef = Cell.source<HTMLElement | null>(null);

    useResizeObserver([firstRef, secondRef], vi.fn());

    const first = renderer.render(
      <div ref={firstRef}>First</div>
    ) as HTMLElement;
    const second = renderer.render(
      <div ref={secondRef}>Second</div>
    ) as HTMLElement;

    renderer.host.document.body.append(first, second);
    renderer.observer?.flush();

    expect(TestResizeObserver.instances).toHaveLength(1);
    expect(TestResizeObserver.instances[0].observe).toHaveBeenCalledWith(
      first,
      undefined
    );
    expect(TestResizeObserver.instances[0].observe).toHaveBeenCalledWith(
      second,
      undefined
    );

    first.remove();
    renderer.observer?.flush();

    expect(TestResizeObserver.instances[0].disconnect).not.toHaveBeenCalled();

    second.remove();
    renderer.observer?.flush();

    expect(TestResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
