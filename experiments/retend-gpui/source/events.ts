import type {
  NativeEventPayload,
  NativeKeyboardEventPayload,
  NativeMouseEventPayload,
} from './native/addon.js';
import type { GpuiNode } from './tree/nodes.js';

import { NativeEventId } from './native/protocol.generated.js';

type NativeTransportEventId = NativeEventPayload['eventId'];

export interface GpuiNativeEventMetadata {
  readonly id: NativeTransportEventId;
  readonly type: string;
  readonly bubbles: boolean;
  readonly captures: boolean;
}

const metadataById = {
  [NativeEventId.Click]: {
    id: NativeEventId.Click,
    type: 'click',
    bubbles: true,
    captures: true,
  },
  [NativeEventId.DblClick]: {
    id: NativeEventId.DblClick,
    type: 'dblclick',
    bubbles: true,
    captures: true,
  },
  [NativeEventId.MouseDown]: {
    id: NativeEventId.MouseDown,
    type: 'mousedown',
    bubbles: true,
    captures: true,
  },
  [NativeEventId.MouseUp]: {
    id: NativeEventId.MouseUp,
    type: 'mouseup',
    bubbles: true,
    captures: true,
  },
  [NativeEventId.MouseEnter]: {
    id: NativeEventId.MouseEnter,
    type: 'mouseenter',
    bubbles: false,
    captures: true,
  },
  [NativeEventId.MouseLeave]: {
    id: NativeEventId.MouseLeave,
    type: 'mouseleave',
    bubbles: false,
    captures: true,
  },
  [NativeEventId.MouseMove]: {
    id: NativeEventId.MouseMove,
    type: 'mousemove',
    bubbles: true,
    captures: true,
  },
  [NativeEventId.KeyDown]: {
    id: NativeEventId.KeyDown,
    type: 'keydown',
    bubbles: true,
    captures: true,
  },
  [NativeEventId.KeyUp]: {
    id: NativeEventId.KeyUp,
    type: 'keyup',
    bubbles: true,
    captures: true,
  },
  [NativeEventId.MouseDownOutside]: {
    id: NativeEventId.MouseDownOutside,
    type: 'mousedownoutside',
    bubbles: false,
    captures: false,
  },
} as const satisfies Record<NativeTransportEventId, GpuiNativeEventMetadata>;

export const NATIVE_EVENT_METADATA = Object.values(metadataById);
const metadataByType = new Map<string, GpuiNativeEventMetadata>(
  NATIVE_EVENT_METADATA.map((metadata) => [metadata.type, metadata])
);

export function nativeEventMetadataById(
  id: NativeTransportEventId
): GpuiNativeEventMetadata {
  return metadataById[id];
}

export function nativeEventMetadataByType(
  type: string
): GpuiNativeEventMetadata | undefined {
  return metadataByType.get(type);
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

interface ListenerRecord {
  readonly callback: EventListenerOrEventListenerObject;
  readonly capture: boolean;
  readonly once: boolean;
  readonly passive: boolean;
  readonly signal?: AbortSignal;
  abortHandler?: () => void;
  removed: boolean;
}

export interface GpuiNodeEventContext {
  nativeSubscriptionChanged(
    node: GpuiNode,
    metadata: GpuiNativeEventMetadata,
    enabled: boolean
  ): void;
  reportListenerError(error: unknown): void;
}

interface DispatchState {
  target: GpuiNode;
  currentTarget: GpuiNode | null;
  path: GpuiNode[];
  phase: number;
  stopped: boolean;
  immediateStopped: boolean;
  passive: boolean;
  dispatching: boolean;
}

const listeners = new WeakMap<GpuiNode, Map<string, ListenerRecord[]>>();
const contexts = new WeakMap<GpuiNode, GpuiNodeEventContext>();
const dispatchStates = new WeakMap<Event, DispatchState>();
const originalPreventDefault = new WeakMap<Event, Event['preventDefault']>();

function captureOption(
  options?: boolean | AddEventListenerOptions | EventListenerOptions
): boolean {
  return typeof options === 'boolean' ? options : (options?.capture ?? false);
}

function cleanupAbort(record: ListenerRecord): void {
  if (record.signal && record.abortHandler) {
    record.signal.removeEventListener('abort', record.abortHandler);
    record.abortHandler = undefined;
  }
}

function syncNativeSubscription(
  node: GpuiNode,
  type: string,
  enabled: boolean
): void {
  const metadata = nativeEventMetadataByType(type);
  if (metadata)
    contexts.get(node)?.nativeSubscriptionChanged(node, metadata, enabled);
}

export function setNodeEventContext(
  node: GpuiNode,
  context: GpuiNodeEventContext
): void {
  contexts.set(node, context);
}

export function addNodeEventListener(
  node: GpuiNode,
  type: string,
  callback: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions
): void {
  if (!callback || node.destroyed) return;
  const signal = typeof options === 'object' ? options.signal : undefined;
  if (signal?.aborted) return;

  const capture = captureOption(options);
  let byType = listeners.get(node);
  if (!byType) listeners.set(node, (byType = new Map()));
  let records = byType.get(type);
  if (!records) byType.set(type, (records = []));
  if (
    records.some(
      (record) => record.callback === callback && record.capture === capture
    )
  ) {
    return;
  }

  const first = records.length === 0;
  const record: ListenerRecord = {
    callback,
    capture,
    once: typeof options === 'object' ? (options.once ?? false) : false,
    passive: typeof options === 'object' ? (options.passive ?? false) : false,
    signal,
    removed: false,
  };
  records.push(record);
  if (signal) {
    record.abortHandler = () =>
      removeNodeEventListener(node, type, callback, { capture });
    signal.addEventListener('abort', record.abortHandler, { once: true });
  }
  if (first) syncNativeSubscription(node, type, true);
}

export function removeNodeEventListener(
  node: GpuiNode,
  type: string,
  callback: EventListenerOrEventListenerObject | null,
  options?: boolean | EventListenerOptions
): void {
  if (!callback) return;
  const records = listeners.get(node)?.get(type);
  if (!records) return;

  const capture = captureOption(options);
  const record = records.find(
    (candidate) =>
      candidate.callback === callback && candidate.capture === capture
  );
  if (record) removeRecord(node, type, record);
}

export function clearNodeEventListeners(node: GpuiNode): void {
  const byType = listeners.get(node);
  if (!byType) {
    contexts.delete(node);
    return;
  }

  for (const [type, records] of byType) {
    const wasEnabled = records.length > 0;
    for (const record of records) {
      record.removed = true;
      cleanupAbort(record);
    }
    if (wasEnabled) syncNativeSubscription(node, type, false);
  }
  listeners.delete(node);
  contexts.delete(node);
}

function patchEvent(event: Event, state: DispatchState): void {
  const preventDefault =
    originalPreventDefault.get(event) ?? event.preventDefault.bind(event);
  originalPreventDefault.set(event, preventDefault);
  Object.defineProperties(event, {
    target: { configurable: true, get: () => state.target },
    currentTarget: { configurable: true, get: () => state.currentTarget },
    eventPhase: { configurable: true, get: () => state.phase },
    cancelBubble: {
      configurable: true,
      get: () => state.stopped,
      set: (value: boolean) => {
        if (value) state.stopped = true;
      },
    },
    composedPath: {
      configurable: true,
      value: () => (state.dispatching ? [...state.path] : []),
    },
    stopPropagation: {
      configurable: true,
      value: () => {
        state.stopped = true;
      },
    },
    stopImmediatePropagation: {
      configurable: true,
      value: () => {
        state.stopped = true;
        state.immediateStopped = true;
      },
    },
    preventDefault: {
      configurable: true,
      value: () => {
        if (!state.passive) preventDefault();
      },
    },
  });
}

function removeRecord(
  node: GpuiNode,
  type: string,
  record: ListenerRecord
): void {
  if (record.removed) return;
  const byType = listeners.get(node);
  const records = byType?.get(type);
  if (!byType || !records) return;
  const index = records.indexOf(record);
  if (index === -1) return;

  records.splice(index, 1);
  record.removed = true;
  cleanupAbort(record);
  if (records.length === 0) {
    byType.delete(type);
    if (byType.size === 0) listeners.delete(node);
    syncNativeSubscription(node, type, false);
  }
}

function invokeListener(
  node: GpuiNode,
  type: string,
  record: ListenerRecord,
  event: Event,
  state: DispatchState
): void {
  if (record.removed) return;
  if (record.once) removeRecord(node, type, record);
  state.passive = record.passive;
  try {
    if (typeof record.callback === 'function')
      record.callback.call(node, event);
    else record.callback.handleEvent(event);
  } catch (error) {
    const context = contexts.get(node);
    if (context) context.reportListenerError(error);
    else console.error('[retend-gpui] event listener failed:', error);
  } finally {
    state.passive = false;
  }
}

function invokeNode(
  node: GpuiNode,
  event: Event,
  state: DispatchState,
  phase: number,
  capture: boolean | null
): void {
  state.currentTarget = node;
  state.phase = phase;
  state.immediateStopped = false;
  const snapshot = [...(listeners.get(node)?.get(event.type) ?? [])];
  for (const record of snapshot) {
    if (record.removed || (capture !== null && record.capture !== capture))
      continue;
    invokeListener(node, event.type, record, event, state);
    if (state.immediateStopped) break;
  }
}

export function dispatchNodeEvent(node: GpuiNode, event: Event): boolean {
  if (node.destroyed) return !event.defaultPrevented;
  const existing = dispatchStates.get(event);
  if (existing?.dispatching)
    throw new DOMException(
      'The event is already being dispatched.',
      'InvalidStateError'
    );

  const path: GpuiNode[] = [];
  for (let current: GpuiNode | null = node; current; current = current.parent)
    path.push(current);
  const state: DispatchState = {
    target: node,
    currentTarget: null,
    path,
    phase: Event.NONE,
    stopped: false,
    immediateStopped: false,
    passive: false,
    dispatching: true,
  };
  dispatchStates.set(event, state);
  patchEvent(event, state);

  try {
    const metadata = nativeEventMetadataByType(event.type);
    if (metadata?.captures ?? true) {
      for (let index = path.length - 1; index > 0; index -= 1) {
        invokeNode(path[index], event, state, Event.CAPTURING_PHASE, true);
        if (state.stopped) break;
      }
    }

    if (!state.stopped) {
      const target = path[0];
      state.currentTarget = target;
      state.phase = Event.AT_TARGET;
      state.immediateStopped = false;
      const snapshot = [...(listeners.get(target)?.get(event.type) ?? [])];
      for (const capture of [true, false]) {
        for (const record of snapshot) {
          if (record.removed || record.capture !== capture) continue;
          invokeListener(target, event.type, record, event, state);
          if (state.immediateStopped) break;
        }
        if (state.immediateStopped) break;
      }
    }

    const bubbles = metadata?.bubbles ?? event.bubbles;
    if (bubbles && !state.stopped) {
      for (let index = 1; index < path.length; index += 1) {
        invokeNode(path[index], event, state, Event.BUBBLING_PHASE, false);
        if (state.stopped) break;
      }
    }
  } finally {
    state.dispatching = false;
    state.currentTarget = null;
    state.phase = Event.NONE;
  }
  return !event.defaultPrevented;
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
  const metadata = nativeEventMetadataById(payload.eventId);
  switch (payload.eventId) {
    case NativeEventId.KeyDown:
    case NativeEventId.KeyUp:
      return new GpuiKeyboardEvent(metadata.type, payload, metadata.bubbles);
    case NativeEventId.Click:
    case NativeEventId.DblClick:
    case NativeEventId.MouseDown:
    case NativeEventId.MouseUp:
    case NativeEventId.MouseEnter:
    case NativeEventId.MouseLeave:
    case NativeEventId.MouseMove:
    case NativeEventId.MouseDownOutside:
      return new GpuiMouseEvent(metadata.type, payload, metadata.bubbles);
    default:
      return unreachableNativeEvent(payload);
  }
}
