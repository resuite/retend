import { afterEach, describe, expect, it, vi } from 'vitest';

import { GpuiHost } from '../source/gpui-host';
import {
  loadNativeAddon,
  NativeRendererFatalError,
} from '../source/native/addon';
import { ElementKind, PropertyId } from '../source/native/protocol';

const activeHosts = new Set<GpuiHost>();

interface DebugNode {
  id: number;
  children: number[];
  text: string | null;
  src: string | null;
}

interface DebugTree {
  nodes: DebugNode[];
  poisoned: boolean;
}

function createHost(headless = true): GpuiHost {
  const host = new GpuiHost({ headless });
  host.init();
  activeHosts.add(host);
  return host;
}

afterEach(() => {
  for (const host of activeHosts) host.close();
  activeHosts.clear();
  vi.restoreAllMocks();
});

describe('Retend-owned native bridge', () => {
  it('flushes synchronous mutations in one queued microtask', async () => {
    const host = createHost();
    const node = host.createText('batched');

    expect(
      (host.debugTree() as DebugTree).nodes.some((item) => item.id === node)
    ).toBe(false);
    await Promise.resolve();
    expect(
      (host.debugTree() as DebugTree).nodes.some((item) => item.id === node)
    ).toBe(true);
  });

  it('creates, mutates, moves, detaches, reattaches, settles, and destroys nodes', () => {
    const host = createHost();
    const parent = host.createNode(ElementKind.Container);
    const image = host.createNode(ElementKind.Image);
    const text = host.createText('second');
    host.insertChild(host.rootId, parent);
    host.insertChild(parent, image);
    host.insertChild(parent, text);
    host.flush();

    host.insertChild(parent, text, image);
    host.removeChild(parent, image);
    host.setProperty(image, PropertyId.Src, 'https://example.com/detached.png');
    host.insertChild(parent, image);
    host.settle();

    const afterMove = host.debugTree() as DebugTree;
    const parentNode = afterMove.nodes.find((node) => node.id === parent);
    expect(parentNode?.children).toEqual([text, image]);
    expect(afterMove.nodes.find((node) => node.id === image)?.src).toBe(
      'https://example.com/detached.png'
    );

    host.removeChild(parent, image);
    host.settle();
    const afterSettle = host.debugTree() as DebugTree;
    expect(afterSettle.nodes.some((node) => node.id === image)).toBe(false);
  });

  it('creates images and replaces their retained source', () => {
    const host = createHost();
    const image = host.createNode(ElementKind.Image);
    host.setProperty(image, PropertyId.Src, 'https://example.com/first.png');
    host.insertChild(host.rootId, image);
    host.flush();

    expect(
      (host.debugTree() as DebugTree).nodes.find((node) => node.id === image)
        ?.src
    ).toBe('https://example.com/first.png');

    host.setProperty(image, PropertyId.Src, 'https://example.com/second.png');
    host.flush();
    expect(
      (host.debugTree() as DebugTree).nodes.find((node) => node.id === image)
        ?.src
    ).toBe('https://example.com/second.png');
  });

  it('leaves node-kind semantic validation to Rust', () => {
    for (const kind of [ElementKind.Root, ElementKind.Text]) {
      const host = createHost();
      host.createNode(kind);
      let failure: NativeRendererFatalError | null = null;
      try {
        host.flush();
      } catch (error) {
        expect(error).toBeInstanceOf(NativeRendererFatalError);
        failure = error as NativeRendererFatalError;
      }
      expect(failure?.nativeFailure?.code).toBe('INVALID_NODE_KIND');
      expect((host.debugTree() as DebugTree).poisoned).toBe(true);
    }
  });

  it('allocates node IDs process-globally across renderer windows', () => {
    const first = createHost();
    const second = createHost();
    const firstChild = first.createNode(ElementKind.Container);
    const secondChild = second.createNode(ElementKind.Container);

    expect(second.rootId).toBeGreaterThan(first.rootId);
    expect(firstChild).not.toBe(secondChild);
    expect(
      new Set([first.rootId, second.rootId, firstChild, secondChild]).size
    ).toBe(4);
  });

  it('rejects cross-window ownership and poisons only the bad renderer', () => {
    const first = createHost();
    const second = createHost();
    const foreignNode = first.createNode(ElementKind.Container);
    first.insertChild(first.rootId, foreignNode);
    first.flush();

    second.insertChild(second.rootId, foreignNode);
    let failure: NativeRendererFatalError | null = null;
    try {
      second.flush();
    } catch (error) {
      expect(error).toBeInstanceOf(NativeRendererFatalError);
      failure = error as NativeRendererFatalError;
    }
    expect(failure?.nativeFailure?.code).toBe('CROSS_WINDOW_NODE');
    expect((second.debugTree() as DebugTree).poisoned).toBe(true);

    const localNode = first.createText('still alive');
    first.insertChild(first.rootId, localNode);
    expect(() => first.flush()).not.toThrow();
    expect((first.debugTree() as DebugTree).poisoned).toBe(false);
  });

  it('retains a valid command prefix when a later command poisons the renderer', () => {
    const host = createHost();
    const node = host.createNode(ElementKind.Container);
    host.insertChild(host.rootId, node);
    host.insertChild(host.rootId, 0xffff_fffe);

    expect(() => host.flush()).toThrow(NativeRendererFatalError);
    const after = host.debugTree() as DebugTree;
    const root = after.nodes.find((item) => item.id === host.rootId);

    expect(after.nodes.some((item) => item.id === node)).toBe(true);
    expect(root?.children).toContain(node);
    expect(after.poisoned).toBe(true);
  });

  it('treats CLOSED_WINDOW as closure instead of a fatal renderer failure', () => {
    const host = createHost();
    const fatal = vi.fn();
    const close = vi.fn();
    host.addEventListener('fatal', fatal);
    host.addEventListener('close', close);
    vi.spyOn(
      loadNativeAddon().NativeRendererBinding.prototype,
      'applyCommandBatch'
    ).mockImplementationOnce(() => {
      throw new Error(
        'RETEND_GPUI_FAILURE:{"code":"CLOSED_WINDOW","message":"Renderer window has already closed."}'
      );
    });

    host.createText('queued');
    let failure: unknown;
    try {
      host.flush();
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(NativeRendererFatalError);
    expect(fatal).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(host.isInitialized).toBe(false);
  });

  it('leaves post-failure rejection to Rust', () => {
    const host = createHost();
    const reportFatal = vi.spyOn(
      loadNativeAddon().NativeRendererBinding.prototype,
      'reportFatal'
    );
    host.createNode(ElementKind.Input);
    expect(() => host.flush()).toThrow(NativeRendererFatalError);

    host.createText('late');
    let failure: unknown;
    try {
      host.flush();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(NativeRendererFatalError);
    expect((failure as NativeRendererFatalError).nativeFailure?.code).toBe(
      'POISONED_RENDERER'
    );
    expect(reportFatal).toHaveBeenCalledOnce();
  });
});
