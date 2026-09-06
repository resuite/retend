import { describe, expect, it, vi } from 'vitest';

import {
  GpuiKeyboardEvent,
  GpuiMouseEvent,
  createNativeEvent,
} from '../source/events';
import { NativeEventId } from '../source/native/protocol.generated';
import { GpuiElement } from '../source/tree/nodes';
import { appendNodes } from '../source/tree/operations';

function tree(): [GpuiElement, GpuiElement, GpuiElement] {
  const root = new GpuiElement(1, 'div');
  const parent = new GpuiElement(2, 'div');
  const target = new GpuiElement(3, 'div');
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
    const target = new GpuiElement(1, 'div');
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
    const target2 = new GpuiElement(4, 'div');
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
    const target = new GpuiElement(1, 'div');
    target.addEventListener('custom', (event) => event.preventDefault());

    expect(
      target.dispatchEvent(new Event('custom', { cancelable: true }))
    ).toBe(false);
    expect(target.dispatchEvent(new Event('custom'))).toBe(true);
  });

  it('restores dispatch state so the same Event can be dispatched again', () => {
    const first = new GpuiElement(1, 'div');
    const second = new GpuiElement(2, 'div');
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
    const reportListenerError = vi.fn();
    const target = new GpuiElement(1, 'div', true, {
      nativeSubscriptionChanged() {},
      reportListenerError,
    });
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
  });

  it('makes passive listeners unable to prevent default', () => {
    const target = new GpuiElement(1, 'div');
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
    const nativeSubscriptionChanged = vi.fn();
    const target = new GpuiElement(1, 'div', true, {
      nativeSubscriptionChanged,
      reportListenerError() {},
    });
    const first = () => {};
    const second = () => {};

    target.addEventListener('click', first);
    target.addEventListener('click', second);
    target.removeEventListener('click', first);
    target.removeEventListener('click', second);
    target.addEventListener('custom', first);

    expect(nativeSubscriptionChanged.mock.calls).toEqual([
      [target, NativeEventId.Click, true],
      [target, NativeEventId.Click, false],
    ]);
  });
});
