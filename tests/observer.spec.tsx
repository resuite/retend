import { Cell, getActiveRenderer, useObserver } from 'retend';
import type { DOMRenderer } from 'retend-web';
import { describe, expect, it, vi } from 'vitest';
import { browserSetup, timeout, vDomSetup } from './setup.tsx';

describe('useObserver', () => {
  browserSetup();

  it('should call callback immediately if node is already connected', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    window.document.body.append(node);

    const nodeRef = Cell.source<HTMLElement | null>(node);
    const callback = vi.fn();

    useObserver().onConnected(nodeRef, callback);

    // It should be called immediately because it's already connected
    expect(callback).toHaveBeenCalledWith(node);
    expect(callback).toHaveBeenCalledTimes(1);

    node.remove();
  });

  it('should call callback when node becomes connected', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const nodeRef = Cell.source<HTMLElement | null>(node);
    const callback = vi.fn();

    useObserver().onConnected(nodeRef, callback);

    expect(callback).not.toHaveBeenCalled();

    window.document.body.append(node);

    // MutationObserver is async
    await timeout(50);

    expect(callback).toHaveBeenCalledWith(node);
    expect(callback).toHaveBeenCalledTimes(1);

    node.remove();
  });

  it('should call cleanup when node is disconnected', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    window.document.body.append(node);

    const nodeRef = Cell.source<HTMLElement | null>(node);
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);

    useObserver().onConnected(nodeRef, callback);
    expect(callback).toHaveBeenCalled();
    // Wait for the async #mount to finish and register cleanups
    await timeout(10);

    node.remove();

    await timeout(50);

    expect(cleanup).toHaveBeenCalled();
  });

  it('should handle multiple callbacks and cleanups', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const nodeRef = Cell.source<HTMLElement | null>(node);

    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const callback1 = vi.fn(() => cleanup1);
    const callback2 = vi.fn(() => cleanup2);

    useObserver().onConnected(nodeRef, callback1);
    useObserver().onConnected(nodeRef, callback2);

    window.document.body.append(node);

    await timeout(50);

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();

    node.remove();

    await timeout(50);

    expect(cleanup1).toHaveBeenCalled();
    expect(cleanup2).toHaveBeenCalled();
  });

  it('should handle async callbacks', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    window.document.body.append(node);

    const nodeRef = Cell.source<HTMLElement | null>(node);
    let resolved = false;
    const cleanup = vi.fn();

    const callback = async () => {
      await timeout(10);
      resolved = true;
      return cleanup;
    };

    useObserver().onConnected(nodeRef, callback);

    await timeout(50);
    expect(resolved).toBe(true);

    node.remove();
    await timeout(50);

    expect(cleanup).toHaveBeenCalled();
  });

  it('should handle ref value change before connection', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const nodeRef = Cell.source<HTMLElement | null>(null);
    const callback = vi.fn();

    useObserver().onConnected(nodeRef, callback);

    // Change ref value
    nodeRef.set(node);

    window.document.body.append(node);

    await timeout(50);

    expect(callback).toHaveBeenCalledWith(node);
    expect(callback).toHaveBeenCalledTimes(1);

    node.remove();
  });
});
