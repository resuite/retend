import { describe, expect, it, vi } from 'vitest';

import {
  GpuiFocusEvent,
  GpuiInputEvent,
  GpuiKeyboardEvent,
  GpuiMouseEvent,
  GpuiScrollEvent,
  createNativeEvent,
} from '../source/events';
import { RetendGpuiRenderer } from '../source/gpui-renderer';
import { NativeEventId } from '../source/native/protocol.generated';
import { GpuiDivElement, type GpuiElement } from '../source/tree/nodes';
import { appendNodes } from '../source/tree/operations';

function tree(): [GpuiElement, GpuiElement, GpuiElement] {
  const root = new GpuiDivElement(1);
  const parent = new GpuiDivElement(2);
  const target = new GpuiDivElement(3);
  appendNodes(root, parent);
  appendNodes(parent, target);
  return [root, parent, target];
}

describe('Retend GPUI event dispatch', () => {
  it('dispatches capture, target, and bubble over a snapshotted logical path', () => {
    const [root, parent, target] = tree();
    const order: string[] = [];
    const path: EventTarget[][] = [];

    root.addEventListener(
      'click',
      (event) => {
        order.push('root-capture');
        path.push(event.composedPath());
        parent.parent = null;
      },
      true
    );
    parent.addEventListener('click', () => order.push('parent-capture'), true);
    target.addEventListener('click', (event) => {
      order.push(`target-${event.eventPhase}`);
      expect(event.target).toBe(target);
      expect(event.currentTarget).toBe(target);
    });
    parent.addEventListener('click', () => order.push('parent-bubble'));
    root.addEventListener('click', () => order.push('root-bubble'));

    target.dispatchEvent(new Event('click', { bubbles: true }));

    expect(order).toEqual([
      'root-capture',
      'parent-capture',
      `target-${Event.AT_TARGET}`,
      'parent-bubble',
      'root-bubble',
    ]);
    expect(path[0]).toEqual([target, parent, root]);
  });

  it('snapshots each node listener list while honoring removals before their turn', () => {
    const target = new GpuiDivElement(1);
    const calls: string[] = [];
    const removed = () => calls.push('removed');
    const added = () => calls.push('added');

    target.addEventListener('custom', () => {
      calls.push('first');
      target.removeEventListener('custom', removed);
      target.addEventListener('custom', added);
    });
    target.addEventListener('custom', removed);

    target.dispatchEvent(new Event('custom'));
    expect(calls).toEqual(['first']);

    target.dispatchEvent(new Event('custom'));
    expect(calls).toEqual(['first', 'first', 'added']);
  });

  it('implements stopPropagation and stopImmediatePropagation independently', () => {
    const [root, parent, target] = tree();
    const calls: string[] = [];

    parent.addEventListener('click', (event) => {
      calls.push('parent-1');
      event.stopPropagation();
    });
    parent.addEventListener('click', () => calls.push('parent-2'));
    root.addEventListener('click', () => calls.push('root'));
    target.dispatchEvent(new Event('click', { bubbles: true }));
    expect(calls).toEqual(['parent-1', 'parent-2']);

    calls.length = 0;
    const target2 = new GpuiDivElement(4);
    target2.addEventListener('click', (event) => {
      calls.push('target-1');
      event.stopImmediatePropagation();
    });
    target2.addEventListener('click', () => calls.push('target-2'));
    target2.dispatchEvent(new Event('click', { bubbles: true }));
    expect(calls).toEqual(['target-1']);
  });

  it('captures but does not bubble non-bubbling native events', () => {
    const [root, , target] = tree();
    const calls: string[] = [];

    root.addEventListener('mouseenter', () => calls.push('capture'), true);
    root.addEventListener('mouseenter', () => calls.push('bubble'));
    target.addEventListener('mouseenter', () => calls.push('target'));
    target.dispatchEvent(new Event('mouseenter', { bubbles: true }));

    expect(calls).toEqual(['capture', 'target']);
  });

  it('returns false only when a cancelable Retend-side default is prevented', () => {
    const target = new GpuiDivElement(1);
    target.addEventListener('custom', (event) => event.preventDefault());

    expect(
      target.dispatchEvent(new Event('custom', { cancelable: true }))
    ).toBe(false);
    expect(target.dispatchEvent(new Event('custom'))).toBe(true);
  });

  it('restores dispatch state so the same Event can be dispatched again', () => {
    const first = new GpuiDivElement(1);
    const second = new GpuiDivElement(2);
    const event = new Event('custom');

    first.dispatchEvent(event);
    expect(event.target).toBe(first);
    expect(event.currentTarget).toBeNull();
    expect(event.eventPhase).toBe(Event.NONE);
    expect(event.composedPath()).toEqual([]);

    second.dispatchEvent(event);
    expect(event.target).toBe(second);
    expect(event.eventPhase).toBe(Event.NONE);
  });

  it('reports listener exceptions and continues the remaining listeners', () => {
    const renderer = new RetendGpuiRenderer();
    const reportListenerError = vi
      .spyOn(renderer, 'reportListenerError')
      .mockImplementation(() => {});
    const target = new GpuiDivElement(1, renderer.host, renderer);
    const second = vi.fn();
    target.addEventListener('custom', () => {
      throw new Error('listener failed');
    });
    target.addEventListener('custom', second);

    target.dispatchEvent(new Event('custom'));

    expect(reportListenerError).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('creates typed native events with pointer and keyboard payloads', () => {
    const mouse = createNativeEvent({
      eventId: NativeEventId.MouseDown,
      targetId: 1,
      timeStamp: 12.5,
      clientX: 20,
      clientY: 30,
      button: 2,
      buttons: 2,
      detail: 3,
      altKey: true,
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
    });
    expect(mouse).toBeInstanceOf(GpuiMouseEvent);
    expect(mouse?.bubbles).toBe(true);
    expect((mouse as GpuiMouseEvent).clientX).toBe(20);
    expect((mouse as GpuiMouseEvent).clientY).toBe(30);
    expect((mouse as GpuiMouseEvent).button).toBe(2);
    expect((mouse as GpuiMouseEvent).buttons).toBe(2);
    expect((mouse as GpuiMouseEvent).detail).toBe(3);
    expect(mouse?.timeStamp).toBe(12.5);

    const keyboard = createNativeEvent({
      eventId: NativeEventId.KeyDown,
      targetId: 1,
      timeStamp: 15,
      key: 'a',
      keyChar: 'A',
      repeat: true,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
    });
    expect(keyboard).toBeInstanceOf(GpuiKeyboardEvent);
    expect((keyboard as GpuiKeyboardEvent).key).toBe('a');
    expect((keyboard as GpuiKeyboardEvent).keyChar).toBe('A');
    expect((keyboard as GpuiKeyboardEvent).repeat).toBe(true);
    expect((keyboard as GpuiKeyboardEvent).shiftKey).toBe(true);

    const input = createNativeEvent({
      eventId: NativeEventId.Input,
      targetId: 1,
      timeStamp: 15.5,
      value: 'edited',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    });
    expect(input).toBeInstanceOf(GpuiInputEvent);
    expect(input.type).toBe('input');
    expect(input.bubbles).toBe(true);
    expect(input.cancelable).toBe(false);
    expect((input as GpuiInputEvent).value).toBe('edited');

    const focus = createNativeEvent({
      eventId: NativeEventId.Focus,
      targetId: 1,
      timeStamp: 16,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    });
    expect(focus).toBeInstanceOf(GpuiFocusEvent);
    expect(focus.bubbles).toBe(false);
    expect(focus.cancelable).toBe(false);
    expect(focus.timeStamp).toBe(16);

    const scroll = createNativeEvent({
      eventId: NativeEventId.Scroll,
      targetId: 1,
      timeStamp: 17,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      scrollX: 12,
      scrollY: 34,
    });
    expect(scroll).toBeInstanceOf(GpuiScrollEvent);
    expect(scroll.type).toBe('scroll');
    expect(scroll.bubbles).toBe(false);
    expect(scroll.cancelable).toBe(false);
    expect(scroll.timeStamp).toBe(17);
    expect((scroll as GpuiScrollEvent).scrollX).toBe(12);
    expect((scroll as GpuiScrollEvent).scrollY).toBe(34);
  });

  it('makes passive listeners unable to prevent default', () => {
    const target = new GpuiDivElement(1);
    const event = new Event('custom', { cancelable: true });
    target.addEventListener('custom', (current) => current.preventDefault(), {
      passive: true,
    });

    expect(target.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps mousedownoutside target-only even with ancestor capture listeners', () => {
    const [root, parent, target] = tree();
    const calls: string[] = [];
    root.addEventListener(
      'mousedownoutside',
      () => calls.push('root-capture'),
      true
    );
    parent.addEventListener(
      'mousedownoutside',
      () => calls.push('parent-capture'),
      true
    );
    parent.addEventListener('mousedownoutside', () =>
      calls.push('parent-bubble')
    );
    target.addEventListener('mousedownoutside', () => calls.push('target'));

    target.dispatchEvent(new Event('mousedownoutside', { bubbles: true }));

    expect(calls).toEqual(['target']);
  });

  it('synchronizes only the first and last listener for native-backed types', () => {
    const renderer = new RetendGpuiRenderer();
    const nativeSubscriptionChanged = vi
      .spyOn(renderer, 'nativeSubscriptionChanged')
      .mockImplementation(() => {});
    const target = new GpuiDivElement(1, renderer.host, renderer);
    const first = () => {};
    const second = () => {};

    target.addEventListener('click', first);
    target.addEventListener('click', second);
    target.removeEventListener('click', first);
    target.removeEventListener('click', second);
    target.addEventListener('scroll', first);
    target.removeEventListener('scroll', first);
    target.addEventListener('custom', first);

    expect(nativeSubscriptionChanged.mock.calls).toEqual([
      [target, NativeEventId.Click, true],
      [target, NativeEventId.Click, false],
      [target, NativeEventId.Scroll, true],
      [target, NativeEventId.Scroll, false],
    ]);
  });
});
