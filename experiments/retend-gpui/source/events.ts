import type {
  NativeEventPayload,
  NativeKeyboardEventPayload,
  NativeMouseEventPayload,
} from './native/addon.js';
import type { GpuiNode } from './tree/nodes.js';

import { NativeEventId } from './native/protocol.generated.js';

export type NativeTransportEventId = NativeEventPayload['eventId'];

export interface GpuiNativeEventMetadata {
  readonly id: NativeTransportEventId;
  readonly bubbles: boolean;
  readonly captures: boolean;
}

export function nativeEventMetadataByType(
  type: string
): GpuiNativeEventMetadata | undefined {
  switch (type) {
    case 'click':
      return { id: NativeEventId.Click, bubbles: true, captures: true };
    case 'dblclick':
      return { id: NativeEventId.DblClick, bubbles: true, captures: true };
    case 'mousedown':
      return { id: NativeEventId.MouseDown, bubbles: true, captures: true };
    case 'mouseup':
      return { id: NativeEventId.MouseUp, bubbles: true, captures: true };
    case 'mouseenter':
      return { id: NativeEventId.MouseEnter, bubbles: false, captures: true };
    case 'mouseleave':
      return { id: NativeEventId.MouseLeave, bubbles: false, captures: true };
    case 'mousemove':
      return { id: NativeEventId.MouseMove, bubbles: true, captures: true };
    case 'keydown':
      return { id: NativeEventId.KeyDown, bubbles: true, captures: true };
    case 'keyup':
      return { id: NativeEventId.KeyUp, bubbles: true, captures: true };
    case 'mousedownoutside':
      return {
        id: NativeEventId.MouseDownOutside,
        bubbles: false,
        captures: false,
      };
    default:
      return undefined;
  }
}

export interface ParsedEventProperty {
  type: string;
  modifiers: readonly string[];
}

export function parseEventProperty(key: string): ParsedEventProperty | null {
  if (!/^on[A-Z]/.test(key)) return null;
  const [property, ...modifiers] = key.split('--');
  return { type: property.slice(2).toLowerCase(), modifiers };
}

export class GpuiEvent extends Event {
  readonly #timeStamp: number;

  constructor(
    type: string,
    init: EventInit = {},
    timeStamp = performance.now()
  ) {
    super(type, init);
    this.#timeStamp = timeStamp;
  }

  override get timeStamp(): number {
    return this.#timeStamp;
  }

  override get target(): GpuiNode | null {
    return super.target as GpuiNode | null;
  }

  override get currentTarget(): GpuiNode | null {
    return super.currentTarget as GpuiNode | null;
  }
}

export class GpuiMouseEvent extends GpuiEvent {
  readonly clientX: number;
  readonly clientY: number;
  readonly button: number;
  readonly buttons: number;
  readonly detail: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;

  constructor(
    type: string,
    payload: NativeMouseEventPayload,
    bubbles: boolean
  ) {
    super(type, { bubbles, cancelable: true }, payload.timeStamp);
    this.clientX = payload.clientX;
    this.clientY = payload.clientY;
    this.button = payload.button;
    this.buttons = payload.buttons;
    this.detail = payload.detail;
    this.altKey = payload.altKey;
    this.ctrlKey = payload.ctrlKey;
    this.metaKey = payload.metaKey;
    this.shiftKey = payload.shiftKey;
  }
}

export class GpuiKeyboardEvent extends GpuiEvent {
  readonly key: string;
  readonly keyChar?: string;
  readonly repeat: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;

  constructor(
    type: string,
    payload: NativeKeyboardEventPayload,
    bubbles: boolean
  ) {
    super(type, { bubbles, cancelable: true }, payload.timeStamp);
    this.key = payload.key;
    this.keyChar = payload.keyChar;
    this.repeat = payload.repeat;
    this.altKey = payload.altKey;
    this.ctrlKey = payload.ctrlKey;
    this.metaKey = payload.metaKey;
    this.shiftKey = payload.shiftKey;
  }
}

function unreachableNativeEvent(payload: never): never {
  throw new Error(`Unknown Retend GPUI native event ID: ${String(payload)}`);
}

export function createNativeEvent(payload: NativeEventPayload): Event {
  switch (payload.eventId) {
    case NativeEventId.Click:
      return new GpuiMouseEvent('click', payload, true);
    case NativeEventId.DblClick:
      return new GpuiMouseEvent('dblclick', payload, true);
    case NativeEventId.MouseDown:
      return new GpuiMouseEvent('mousedown', payload, true);
    case NativeEventId.MouseUp:
      return new GpuiMouseEvent('mouseup', payload, true);
    case NativeEventId.MouseEnter:
      return new GpuiMouseEvent('mouseenter', payload, false);
    case NativeEventId.MouseLeave:
      return new GpuiMouseEvent('mouseleave', payload, false);
    case NativeEventId.MouseMove:
      return new GpuiMouseEvent('mousemove', payload, true);
    case NativeEventId.KeyDown:
      return new GpuiKeyboardEvent('keydown', payload, true);
    case NativeEventId.KeyUp:
      return new GpuiKeyboardEvent('keyup', payload, true);
    case NativeEventId.MouseDownOutside:
      return new GpuiMouseEvent('mousedownoutside', payload, false);
    default:
      return unreachableNativeEvent(payload);
  }
}
