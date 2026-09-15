import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  NativeMouseEventPayload,
  NativeTransportPayload,
  NativeWindowOptions,
} from '../source/native/addon';

const native = vi.hoisted(() => ({
  onEvent: undefined as ((event: NativeTransportPayload) => void) | undefined,
  presented: true,
  applyCalls: 0,
  options: undefined as NativeWindowOptions | undefined,
}));

vi.mock('../source/native/addon', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  class NativeRendererBinding {
    readonly windowId = 1;

    constructor(
      _rootId: number,
      _headless: boolean,
      options?: NativeWindowOptions,
      onEvent?: (event: NativeTransportPayload) => void
    ) {
      native.options = options;
      native.onEvent = onEvent;
      native.presented = true;
    }

    applyCommandBatch(): void {
      native.applyCalls++;
    }
    settle(): void {}
    reportFatal(): void {}
    setWindowTitle(): void {}
    close(): void {}
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

import { Cell } from 'retend';

import { GpuiImageEvent, GpuiMouseEvent } from '../source/events';
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
  native.applyCalls = 0;
  native.options = undefined;
});

describe('native event delivery', () => {
  it('rejects invalid native window options at the renderer boundary', () => {
    const current = new RetendGpuiRenderer({ headless: true });
    expect(() => current.init({ width: 0 })).toThrow('finite positive');
    expect(() => current.init({ minWidth: 900, maxWidth: 800 })).toThrow(
      'minWidth cannot exceed maxWidth'
    );
    expect(() => current.init({ fullscreen: true, maximized: true })).toThrow(
      'cannot both be true'
    );
  });

  it('forwards native window state and size constraints at creation', () => {
    const current = new RetendGpuiRenderer({ headless: true });
    current.init({
      width: 900,
      height: 600,
      resizable: false,
      maximized: true,
      minWidth: 500,
      minHeight: 400,
      maxWidth: 1200,
      maxHeight: 900,
    });
    renderer = current;

    expect(native.options).toEqual({
      title: undefined,
      width: 900,
      height: 600,
      resizable: false,
      fullscreen: undefined,
      maximized: true,
      minWidth: 500,
      minHeight: 400,
      maxWidth: 1200,
      maxHeight: 900,
    });
  });

  it('seeds window navigation from the location option', () => {
    const current = new RetendGpuiRenderer({ headless: true });
    current.init({ location: '/configured?tab=1#section' });
    renderer = current;

    expect(current.host.location.pathname).toBe('/configured');
    expect(current.host.location.search).toBe('?tab=1');
    expect(current.host.location.hash).toBe('#section');
  });

  it('releases the logical root when the native window closes', () => {
    const current = createRenderer();
    const ref = Cell.source<object | null>(null);
    current.render(() => {
      const element = current.createContainer('div');
      current.setProperty(element, 'ref', ref);
      return element;
    });
    expect(ref.peek()).not.toBeNull();
    expect(current.hasRoot).toBe(true);

    native.onEvent?.({ window: { kind: 'close' } } as NativeTransportPayload);

    expect(ref.peek()).toBeNull();
    expect(current.hasRoot).toBe(false);
  });

  it('forwards native resize and activation changes through the window host', () => {
    const renderer = createRenderer();
    const sizes: unknown[] = [];
    const focus = vi.fn();
    const blur = vi.fn();
    const reload = vi.fn();
    const close = vi.fn();
    renderer.host.addEventListener('resize', (event) => {
      sizes.push((event as CustomEvent<unknown>).detail);
    });
    renderer.host.addEventListener('focus', focus);
    renderer.host.addEventListener('blur', blur);
    renderer.host.addEventListener('reload', reload);
    renderer.host.addEventListener('close', close);

    native.onEvent?.({
      window: { kind: 'resize', width: 1024, height: 720 },
    });
    native.onEvent?.({ window: { kind: 'focus' } });
    native.onEvent?.({ window: { kind: 'blur' } });
    native.onEvent?.({ window: { kind: 'reload' } });

    expect(sizes).toEqual([{ width: 1024, height: 720 }]);
    expect(focus).toHaveBeenCalledOnce();
    expect(blur).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();

    native.onEvent?.({ window: { kind: 'close' } });
    expect(close).toHaveBeenCalledOnce();
    expect(renderer.host.isInitialized).toBe(false);
  });

  it('flushes mutations produced by a native resize before returning to native', () => {
    const renderer = createRenderer();
    renderer.host.addEventListener('resize', () => {
      renderer.host.createText('resized');
    });

    native.onEvent?.({
      window: { kind: 'resize', width: 1024, height: 720 },
    });

    expect(native.applyCalls).toBe(1);
  });

  it('rejects unknown native window event kinds', () => {
    createRenderer();
    expect(() =>
      native.onEvent?.({ window: { kind: 'future-window-event' } } as never)
    ).toThrow('Unknown native window event');
  });

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

    native.onEvent?.({ event: mouseEvent(NativeEventId.Click, child.id) });

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
    native.onEvent?.({ event: payload });
    expect(listener).not.toHaveBeenCalled();

    native.presented = true;
    renderer.unmount();
    native.onEvent?.({ event: payload });
    expect(listener).not.toHaveBeenCalled();
  });

  it('delivers native image load/error events to img targets without bubbling', () => {
    const renderer = createRenderer();
    const parent = renderer.createContainer('div');
    const image = renderer.createContainer('img');
    renderer.append(parent, image);
    renderer.render(() => parent);

    const parentLoad = vi.fn();
    const imageLoad = vi.fn();
    const imageError = vi.fn();
    parent.addEventListener('load', parentLoad);
    image.addEventListener('load', imageLoad);
    image.addEventListener('error', imageError);

    native.onEvent?.({
      event: {
        eventId: NativeEventId.Load,
        targetId: image.id,
        timeStamp: 22,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      },
    });
    expect(imageLoad).toHaveBeenCalledOnce();
    expect(imageLoad.mock.calls[0][0]).toBeInstanceOf(GpuiImageEvent);
    expect(imageLoad.mock.calls[0][0].type).toBe('load');
    expect(parentLoad).not.toHaveBeenCalled();

    native.onEvent?.({
      event: {
        eventId: NativeEventId.Error,
        targetId: image.id,
        timeStamp: 23,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      },
    });
    expect(imageError).toHaveBeenCalledOnce();
    expect(imageError.mock.calls[0][0].type).toBe('error');
  });

  it('binds img onLoad/onError JSX props to native subscriptions', () => {
    const renderer = createRenderer();
    const load = vi.fn();
    const error = vi.fn();
    const image = renderer.createContainer('img');
    renderer.setProperty(image, 'src', 'https://example.com/image.png');
    renderer.setProperty(image, 'onLoad', load);
    renderer.setProperty(image, 'onError', error);
    renderer.render(() => image);

    native.onEvent?.({
      event: {
        eventId: NativeEventId.Load,
        targetId: image.id,
        timeStamp: 24,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      },
    });
    expect(load).toHaveBeenCalledOnce();

    renderer.setProperty(image, 'onLoad', null);
    renderer.setProperty(image, 'onError', null);
    native.onEvent?.({
      event: {
        eventId: NativeEventId.Error,
        targetId: image.id,
        timeStamp: 25,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      },
    });
    expect(error).not.toHaveBeenCalled();
  });
});
