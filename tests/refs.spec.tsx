import { Cell, getActiveRenderer } from 'retend';
import type { VNode } from 'retend-server/v-dom';
import type { DOMRenderer } from 'retend-web';
import { describe, expect, it, vi } from 'vitest';
import { browserSetup, vDomSetup } from './setup.tsx';

const runTests = () => {
  it('should assign a ref to an element', () => {
    const renderer = getActiveRenderer();
    const elementRef = Cell.source<HTMLElement | null>(null);
    const element = renderer.render(
      <div ref={elementRef}>Hello, world!</div>
    ) as unknown as HTMLElement;

    expect(elementRef.peek()).toBe(element);
  });

  it('should work with functional components', () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const elementRef = Cell.source<HTMLElement | null>(null);
    const callback = vi.fn();

    const MyComponent = () => {
      return <div ref={elementRef}>Hello, world!</div>;
    };

    const element = renderer.render(<MyComponent />) as unknown as HTMLElement &
      VNode;

    expect(elementRef.peek()).toBe(element);
    expect(elementRef.peek()).toBeInstanceOf(window.HTMLElement);

    elementRef.listen(callback);
    const newInstance = renderer.render(<MyComponent />);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(elementRef.peek()).toBe(newInstance);
  });
};

describe('Refs', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
