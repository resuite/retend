import type {
  NativeEventPayload,
  NativeFocusEventPayload,
  NativeKeyboardEventPayload,
  NativeMouseEventPayload,
  NativeScrollEventPayload,
  NativeTextEventPayload,
  NativeTransitionEventPayload,
} from './native/addon.js';
import type { GpuiNode } from './tree/nodes.js';

import { NativeEventId } from './native/protocol.generated.js';

export type NativeTransportEventId = NativeEventPayload['eventId'];

export interface GpuiNativeEventMetadata {
  readonly id: NativeTransportEventId;
  readonly bubbles: boolean;
  readonly captures: boolean;
}

type NativeEventKind =
  | 'mouse'
  | 'keyboard'
  | 'text'
  | 'focus'
  | 'scroll'
  | 'transition';
type NativeEventDefinition = readonly [
  type: string,
  kind: NativeEventKind,
  bubbles: boolean,
  captures: boolean,
];

const NATIVE_EVENTS = {
  [NativeEventId.Click]: ['click', 'mouse', true, true],
  [NativeEventId.DblClick]: ['dblclick', 'mouse', true, true],
  [NativeEventId.MouseDown]: ['mousedown', 'mouse', true, true],
  [NativeEventId.MouseUp]: ['mouseup', 'mouse', true, true],
  [NativeEventId.MouseEnter]: ['mouseenter', 'mouse', false, true],
  [NativeEventId.MouseLeave]: ['mouseleave', 'mouse', false, true],
  [NativeEventId.MouseMove]: ['mousemove', 'mouse', true, true],
  [NativeEventId.KeyDown]: ['keydown', 'keyboard', true, true],
  [NativeEventId.KeyUp]: ['keyup', 'keyboard', true, true],
  [NativeEventId.Input]: ['input', 'text', true, true],
  [NativeEventId.Change]: ['change', 'text', true, true],
  [NativeEventId.Focus]: ['focus', 'focus', false, true],
  [NativeEventId.Blur]: ['blur', 'focus', false, true],
  [NativeEventId.Scroll]: ['scroll', 'scroll', false, true],
  [NativeEventId.MouseDownOutside]: ['mousedownoutside', 'mouse', false, false],
  [NativeEventId.TransitionRun]: ['transitionrun', 'transition', true, true],
  [NativeEventId.TransitionStart]: [
    'transitionstart',
    'transition',
    true,
    true,
  ],
  [NativeEventId.TransitionEnd]: ['transitionend', 'transition', true, true],
  [NativeEventId.TransitionCancel]: [
    'transitioncancel',
    'transition',
    true,
    true,
  ],
} as const satisfies Record<NativeTransportEventId, NativeEventDefinition>;

const EVENT_METADATA = new Map<string, GpuiNativeEventMetadata>(
  Object.entries(NATIVE_EVENTS).map(([id, [type, , bubbles, captures]]) => [
    type,
    { id: Number(id) as NativeTransportEventId, bubbles, captures },
  ])
);

export function nativeEventMetadataByType(
  type: string
): GpuiNativeEventMetadata | undefined {
  return EVENT_METADATA.get(type);
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

export class GpuiInputEvent extends GpuiEvent {
  readonly value: string;

  constructor(type: 'input' | 'change', payload: NativeTextEventPayload) {
    super(type, { bubbles: true, cancelable: false }, payload.timeStamp);
    this.value = payload.value;
  }
}

export class GpuiFocusEvent extends GpuiEvent {
  constructor(type: 'focus' | 'blur', payload: NativeFocusEventPayload) {
    super(type, { bubbles: false, cancelable: false }, payload.timeStamp);
  }
}

export class GpuiScrollEvent extends GpuiEvent {
  readonly scrollX: number;
  readonly scrollY: number;

  constructor(payload: NativeScrollEventPayload) {
    super('scroll', { bubbles: false, cancelable: false }, payload.timeStamp);
    this.scrollX = payload.scrollX;
    this.scrollY = payload.scrollY;
  }
}

export type GpuiTransitionEventType = Extract<
  (typeof NATIVE_EVENTS)[keyof typeof NATIVE_EVENTS][0],
  `transition${string}`
>;

export class GpuiTransitionEvent extends GpuiEvent {
  readonly propertyName: string;
  readonly elapsedTime: number;
  readonly pseudoElement = '';

  constructor(
    type: GpuiTransitionEventType,
    payload: NativeTransitionEventPayload
  ) {
    super(type, { bubbles: true, cancelable: false }, payload.timeStamp);
    this.propertyName = payload.propertyName;
    this.elapsedTime = payload.elapsedTime;
  }
}

class GpuiModifierEvent extends GpuiEvent {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;

  constructor(
    type: string,
    payload: NativeMouseEventPayload | NativeKeyboardEventPayload,
    bubbles: boolean
  ) {
    super(type, { bubbles, cancelable: true }, payload.timeStamp);
    this.altKey = payload.altKey;
    this.ctrlKey = payload.ctrlKey;
    this.metaKey = payload.metaKey;
    this.shiftKey = payload.shiftKey;
  }
}

export class GpuiMouseEvent extends GpuiModifierEvent {
  readonly clientX: number;
  readonly clientY: number;
  readonly button: number;
  readonly buttons: number;
  readonly detail: number;

  constructor(
    type: string,
    payload: NativeMouseEventPayload,
    bubbles: boolean
  ) {
    super(type, payload, bubbles);
    this.clientX = payload.clientX;
    this.clientY = payload.clientY;
    this.button = payload.button;
    this.buttons = payload.buttons;
    this.detail = payload.detail;
  }
}

export class GpuiKeyboardEvent extends GpuiModifierEvent {
  readonly key: string;
  readonly keyChar?: string;
  readonly repeat: boolean;

  constructor(
    type: string,
    payload: NativeKeyboardEventPayload,
    bubbles: boolean
  ) {
    super(type, payload, bubbles);
    this.key = payload.key;
    this.keyChar = payload.keyChar;
    this.repeat = payload.repeat;
  }
}

export function createNativeEvent(payload: NativeEventPayload): Event {
  const definition = NATIVE_EVENTS[payload.eventId] as
    | NativeEventDefinition
    | undefined;
  if (!definition) {
    throw new Error(`Unknown Retend GPUI native event ID: ${payload.eventId}`);
  }

  const [type, kind, bubbles] = definition;
  switch (kind) {
    case 'mouse':
      return new GpuiMouseEvent(
        type,
        payload as NativeMouseEventPayload,
        bubbles
      );
    case 'keyboard':
      return new GpuiKeyboardEvent(
        type,
        payload as NativeKeyboardEventPayload,
        bubbles
      );
    case 'text':
      return new GpuiInputEvent(
        type as 'input' | 'change',
        payload as NativeTextEventPayload
      );
    case 'focus':
      return new GpuiFocusEvent(
        type as 'focus' | 'blur',
        payload as NativeFocusEventPayload
      );
    case 'scroll':
      return new GpuiScrollEvent(payload as NativeScrollEventPayload);
    case 'transition':
      return new GpuiTransitionEvent(
        type as GpuiTransitionEventType,
        payload as NativeTransitionEventPayload
      );
  }
}
