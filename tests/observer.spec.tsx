import type { DOMRenderer } from 'retend-web';

import { Cell, getActiveRenderer, onConnected } from 'retend';
import { describe, expect, it, vi } from 'vitest';

import { browserSetup, timeout } from './setup.tsx';

describe('onConnected', () => {
  browserSetup();

  it('should call callback immediately if node is already connected', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    window.document.body.append(node);

    const nodeRef = Cell.source<HTMLElement | null>(node);
    const callback = vi.fn();

    onConnected(nodeRef, callback);

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

    onConnected(nodeRef, callback);

    expect(callback).not.toHaveBeenCalled();

    window.document.body.append(node);

    await timeout(0);

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

    onConnected(nodeRef, callback);
    expect(callback).toHaveBeenCalled();
    await timeout(0);

    node.remove();

    await timeout(0);

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

    onConnected(nodeRef, callback1);
    onConnected(nodeRef, callback2);

    window.document.body.append(node);

    await timeout(0);

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();

    node.remove();

    await timeout(0);

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

    onConnected(nodeRef, callback);

    await timeout(20);
    expect(resolved).toBe(true);

    node.remove();
    await timeout(0);

    expect(cleanup).toHaveBeenCalled();
  });

  it('should handle ref value change before connection', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const nodeRef = Cell.source<HTMLElement | null>(null);
    const callback = vi.fn();

    onConnected(nodeRef, callback);

    nodeRef.set(node);

    window.document.body.append(node);

    await timeout(0);

    expect(callback).toHaveBeenCalledWith(node);
    expect(callback).toHaveBeenCalledTimes(1);

    node.remove();
  });

  it('should call cleanup when parent is disconnected', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const parent = window.document.createElement('div');
    const child = window.document.createElement('span');
    parent.append(child);
    window.document.body.append(parent);

    const childRef = Cell.source<HTMLElement | null>(child);
    const cleanup = vi.fn();
    onConnected(childRef, () => cleanup);

    await timeout(0);
    expect(child.isConnected).toBe(true);

    parent.remove();
    await timeout(0);

    expect(cleanup).toHaveBeenCalled();
  });

  it('should handle changing ref value after it has been connected', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node1 = window.document.createElement('div');
    const node2 = window.document.createElement('div');
    const nodeRef = Cell.source<HTMLElement | null>(null);
    const callback = vi.fn();

    onConnected(nodeRef, callback);

    nodeRef.set(node1);
    window.document.body.append(node1);
    await timeout(0);
    expect(callback).toHaveBeenCalledWith(node1);
    expect(callback).toHaveBeenCalledTimes(1);

    const callback2 = vi.fn();
    nodeRef.set(node2);
    onConnected(nodeRef, callback2);
    window.document.body.append(node2);
    await timeout(0);
    expect(callback2).toHaveBeenCalledWith(node2);
    expect(callback2).toHaveBeenCalledTimes(1);

    node1.remove();
    node2.remove();
  });

  it('should handle ref being set to null while waiting for connection', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const nodeRef = Cell.source<HTMLElement | null>(node);
    const callback = vi.fn();

    onConnected(nodeRef, callback);

    nodeRef.set(null);

    window.document.body.append(node);
    await timeout(0);

    expect(callback).not.toHaveBeenCalled();

    node.remove();
  });

  it('should work with derived cells', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const baseRef = Cell.source<HTMLElement | null>(node);
    const derivedRef = Cell.derived(() => baseRef.get());
    const callback = vi.fn();

    onConnected(derivedRef, callback);

    window.document.body.append(node);
    await timeout(0);

    expect(callback).toHaveBeenCalledWith(node);
    expect(callback).toHaveBeenCalledTimes(1);

    node.remove();
  });

  it('should work when multiple refs point to the same node', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const ref1 = Cell.source<HTMLElement | null>(node);
    const ref2 = Cell.source<HTMLElement | null>(node);
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    onConnected(ref1, callback1);
    onConnected(ref2, callback2);

    window.document.body.append(node);
    await timeout(0);

    expect(callback1).toHaveBeenCalledWith(node);
    expect(callback2).toHaveBeenCalledWith(node);

    node.remove();
  });
});
