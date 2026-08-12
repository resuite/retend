import type { DOMRenderer } from 'retend-web';

import {
  Cell,
  For,
  If,
  getState,
  getActiveRenderer,
  onConnected,
  onSetup,
  runPendingSetupEffects,
} from 'retend';
import { describe, expect, it, vi } from 'vitest';

import { browserSetup, timeout } from './setup.tsx';

const activateEffects = async () => {
  await getState().node.activate();
};

describe('onConnected', () => {
  browserSetup();

  it('should call callback when its scope activates with an already connected node', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    window.document.body.append(node);

    const nodeRef = Cell.source<HTMLElement | null>(node);
    const callback = vi.fn();

    onConnected(nodeRef, callback);
    await activateEffects();

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

    await activateEffects();

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
    await activateEffects();
    expect(callback).toHaveBeenCalled();
    await timeout(0);

    node.remove();

    await activateEffects();

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

    await activateEffects();
    await timeout(0);

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();

    node.remove();

    await activateEffects();

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
    await activateEffects();

    await timeout(20);
    expect(resolved).toBe(true);

    node.remove();
    await activateEffects();

    expect(cleanup).toHaveBeenCalled();
  });

  it('should clean up stale async connections after ref changes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const first = window.document.createElement('div');
    const second = window.document.createElement('span');
    const ref = Cell.source<HTMLElement | null>(null);
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn();
    let resolveFirst = () => {};
    let resolveSecond = () => {};

    window.document.body.append(first, second);
    onConnected(
      ref,
      (node) =>
        new Promise((resolve) => {
          if (node === first) resolveFirst = () => resolve(firstCleanup);
          else resolveSecond = () => resolve(secondCleanup);
        })
    );

    ref.set(first);
    await activateEffects();
    ref.set(second);
    resolveFirst();
    await timeout(0);
    expect(firstCleanup).toHaveBeenCalledTimes(1);

    resolveSecond();
    await timeout(0);
    ref.set(null);
    expect(secondCleanup).toHaveBeenCalledTimes(1);
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

    await activateEffects();

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
    await activateEffects();

    expect(child.isConnected).toBe(true);

    parent.remove();
    await activateEffects();

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
    await activateEffects();
    expect(callback).toHaveBeenCalledWith(node1);
    expect(callback).toHaveBeenCalledTimes(1);

    const callback2 = vi.fn();
    nodeRef.set(node2);
    onConnected(nodeRef, callback2);
    window.document.body.append(node2);
    await activateEffects();
    expect(callback2).toHaveBeenCalledWith(node2);
    expect(callback2).toHaveBeenCalledTimes(1);

    node1.remove();
    node2.remove();
  });

  it('should follow ref changes after connection', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node1 = window.document.createElement('div');
    const node2 = window.document.createElement('span');
    const nodeRef = Cell.source<HTMLElement | null>(null);
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);

    window.document.body.append(node1, node2);
    onConnected(nodeRef, callback);

    nodeRef.set(node1);
    await activateEffects();
    expect(callback).toHaveBeenLastCalledWith(node1);

    nodeRef.set(node2);
    await activateEffects();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(node2);
    expect(callback).toHaveBeenCalledTimes(2);

    node1.remove();
    node2.remove();
  });

  it('should rerun callback when the same node reconnects', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const nodeRef = Cell.source<HTMLElement | null>(node);
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);

    window.document.body.append(node);
    onConnected(nodeRef, callback);
    await activateEffects();
    expect(callback).toHaveBeenCalledTimes(1);

    node.remove();
    await activateEffects();
    expect(cleanup).toHaveBeenCalledTimes(1);

    window.document.body.append(node);
    await activateEffects();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(node);

    node.remove();
  });

  it('should clean up when a connected ref is cleared', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const node = window.document.createElement('div');
    const nodeRef = Cell.source<HTMLElement | null>(node);
    const cleanup = vi.fn();

    window.document.body.append(node);
    onConnected(nodeRef, () => cleanup);
    await activateEffects();
    nodeRef.set(null);
    await activateEffects();

    expect(cleanup).toHaveBeenCalledTimes(1);
    node.remove();
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
    await activateEffects();

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
    await activateEffects();

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
    await activateEffects();

    expect(callback1).toHaveBeenCalledWith(node);
    expect(callback2).toHaveBeenCalledWith(node);

    node.remove();
  });

  it('should call onSetup after onConnected', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const order: string[] = [];
    const ref = Cell.source<HTMLElement | null>(null);
    const Component = () => {
      onConnected(ref, () => {
        order.push('connected');
      });
      onSetup(() => {
        order.push('setup');
      });
      return <div ref={ref} />;
    };

    renderer.host.document.body.append(renderer.render(<Component />) as Node);
    await runPendingSetupEffects();

    expect(order).toEqual(['connected', 'setup']);
  });

  it('should support onConnected without setup effects', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const node = renderer.host.document.createElement('div');
    const ref = Cell.source<HTMLElement | null>(node);
    const connected = vi.fn();
    const setup = vi.fn();

    renderer.capabilities.supportsSetupEffects = false;
    try {
      onConnected(ref, connected);
      onSetup(setup);

      renderer.host.document.body.append(node);
      await runPendingSetupEffects();

      expect(connected).toHaveBeenCalledWith(node);
      expect(setup).not.toHaveBeenCalled();
    } finally {
      renderer.capabilities.supportsSetupEffects = true;
      node.remove();
    }
  });

  it("should call onSetup's cleanup before onConnected's cleanup", async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const order: string[] = [];
    const show = Cell.source(true);
    const ref = Cell.source<HTMLElement | null>(null);
    const Component = () => {
      onConnected(ref, () => () => {
        order.push('connected');
      });
      onSetup(() => () => {
        order.push('setup');
      });
      return <div ref={ref} />;
    };

    renderer.host.document.body.append(
      renderer.render(<div>{If(show, Component)}</div>) as Node
    );
    await runPendingSetupEffects();
    show.set(false);

    expect(order).toEqual(['setup', 'connected']);
  });

  it('should not observe ref changes after disposal', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const show = Cell.source(true);
    const ref = Cell.source<HTMLElement | null>(null);
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const Component = () => {
      onConnected(ref, callback);
      return <div ref={ref} />;
    };

    window.document.body.append(
      renderer.render(<div>{If(show, Component)}</div>) as Node
    );
    await runPendingSetupEffects();
    expect(callback).toHaveBeenCalledTimes(1);

    show.set(false);
    expect(cleanup).toHaveBeenCalledTimes(1);

    const node = window.document.createElement('span');
    window.document.body.append(node);
    ref.set(node);
    await activateEffects();

    expect(callback).toHaveBeenCalledTimes(1);
    node.remove();
  });

  it('should activate connected effects for new For item branches', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const items = Cell.source([1]);
    const connected: number[] = [];
    const Item = (item: number) => {
      const ref = Cell.source<HTMLElement | null>(null);
      onConnected(ref, () => {
        connected.push(item);
      });
      return <span ref={ref}>{item}</span>;
    };

    window.document.body.append(
      renderer.render(<div>{For(items, Item)}</div>) as Node
    );
    await runPendingSetupEffects();

    items.set([1, 2, 3, 4]);

    expect(connected).toEqual([1, 2, 3, 4]);
  });

  it('should have refs connected in onSetup', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const connected = Cell.source(false);
    const ref = Cell.source<HTMLElement | null>(null);
    const Component = () => {
      onSetup(() => connected.set(ref.get()?.isConnected ?? false));
      return <div ref={ref} />;
    };

    renderer.host.document.body.append(renderer.render(<Component />) as Node);
    await runPendingSetupEffects();

    expect(connected.get()).toBe(true);
  });
});
