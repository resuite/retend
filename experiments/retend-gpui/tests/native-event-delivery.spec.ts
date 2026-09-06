import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  NativeEventPayload,
  NativeMouseEventPayload,
} from '../source/native/addon';

const native = vi.hoisted(() => ({
  onEvent: undefined as ((event: NativeEventPayload) => void) | undefined,
  presented: true,
  closed: false,
}));

vi.mock('../source/native/addon', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  class NativeRendererBinding {
    readonly windowId = 1;

    constructor(
      _rootId: number,
      _headless: boolean,
      _options?: unknown,
      onEvent?: (event: NativeEventPayload) => void
    ) {
      native.onEvent = onEvent;
      native.presented = true;
      native.closed = false;
    }

    applyCommandBatch(): void {}
    settle(): void {}
    takeReloadRequested(): boolean {
      return false;
    }
    reportFatal(): void {}
    setWindowTitle(): void {}
    close(): void {
      native.closed = true;
    }
    isClosed(): boolean {
      return native.closed;
    }
    isNodePresented(): boolean {
      return native.presented;
    }
    debugTreeJson(): string {
      return '{}';
    }
  }

  return {
    ...actual,
    loadNativeAddon: () => ({
      NativeRendererBinding,
      tick: () => true,
    }),
  };
});

import { GpuiMouseEvent } from '../source/events';
import { RetendGpuiRenderer } from '../source/gpui-renderer';
import { NativeEventId } from '../source/native/protocol.generated';

let renderer: RetendGpuiRenderer | null = null;

function mouseEvent(
  eventId: NativeMouseEventPayload['eventId'],
  targetId: number
): NativeMouseEventPayload {
  return {
    eventId,
    targetId,
    timeStamp: 12.5,
    clientX: 20,
    clientY: 30,
    button: 0,
    buttons: 1,
    detail: 1,
    altKey: false,
    ctrlKey: true,
    metaKey: false,
    shiftKey: true,
  };
}

function createRenderer(): RetendGpuiRenderer {
  const current = new RetendGpuiRenderer({ headless: true });
  current.init();
  renderer = current;
  return current;
}

afterEach(() => {
  renderer?.dispose();
  renderer = null;
  native.onEvent = undefined;
  native.presented = true;
  native.closed = false;
});

describe('native event delivery', () => {
  it('maps the native target into Retend propagation with the native payload intact', () => {
    const renderer = createRenderer();
    const parent = renderer.createContainer('div');
    const child = renderer.createContainer('div');
    renderer.append(parent, child);
    renderer.render(() => parent);

    const calls: string[] = [];
    let received: GpuiMouseEvent | undefined;
    parent.addEventListener('click', (event) => {
      calls.push('parent');
      expect(event.target).toBe(child);
    });
    child.addEventListener('click', (event) => {
      calls.push('child');
      received = event as GpuiMouseEvent;
    });

    native.onEvent?.(mouseEvent(NativeEventId.Click, child.id));

    expect(calls).toEqual(['child', 'parent']);
    expect(received).toBeInstanceOf(GpuiMouseEvent);
    expect(received).toMatchObject({
      clientX: 20,
      clientY: 30,
      button: 0,
      buttons: 1,
      detail: 1,
      ctrlKey: true,
      shiftKey: true,
    });
    expect(received?.timeStamp).toBe(12.5);
  });

  it('drops delayed native events after native presentation or logical ownership is lost', () => {
    const renderer = createRenderer();
    const target = renderer.createContainer('div');
    renderer.render(() => target);
    const listener = vi.fn();
    target.addEventListener('click', listener);
    const payload = mouseEvent(NativeEventId.Click, target.id);

    native.presented = false;
    native.onEvent?.(payload);
    expect(listener).not.toHaveBeenCalled();

    native.presented = true;
    renderer.unmount();
    native.onEvent?.(payload);
    expect(listener).not.toHaveBeenCalled();
  });

  it('delivers mousedownoutside only to the subscriber targeted by native selection', () => {
    const renderer = createRenderer();
    const ancestor = renderer.createContainer('div');
    const subscriber = renderer.createContainer('div');
    renderer.append(ancestor, subscriber);
    renderer.render(() => ancestor);

    const ancestorListener = vi.fn();
    const subscriberListener = vi.fn();
    ancestor.addEventListener('mousedownoutside', ancestorListener);
    subscriber.addEventListener('mousedownoutside', subscriberListener);

    native.onEvent?.(mouseEvent(NativeEventId.MouseDownOutside, subscriber.id));

    expect(subscriberListener).toHaveBeenCalledOnce();
    expect(ancestorListener).not.toHaveBeenCalled();
  });
});
