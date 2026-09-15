import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import type {
  GpuiMeasurement,
  GpuiScrollOffset,
  GpuiSelection,
} from '../types.js';
import type { GpuiWindowOptions } from '../window.js';
import type { NativeEventId } from './protocol.generated.js';

export interface NativeBridgeFailure {
  code: string;
  message: string;
  commandIndex?: number;
  offset?: number;
}

export type NativeWindowOptions = Omit<
  GpuiWindowOptions,
  'location' | 'closeWithOpener'
>;

interface NativeEventBase {
  targetId: number;
  timeStamp: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

type NativeEventIds<Names extends keyof typeof NativeEventId> =
  (typeof NativeEventId)[Names];
type NativeMouseEventId = NativeEventIds<
  | 'Click'
  | 'DblClick'
  | 'MouseDown'
  | 'MouseUp'
  | 'MouseEnter'
  | 'MouseLeave'
  | 'MouseMove'
  | 'MouseDownOutside'
>;
type NativeKeyboardEventId = NativeEventIds<'KeyDown' | 'KeyUp'>;
type NativeTextEventId = NativeEventIds<'Input' | 'Change'>;
type NativeFocusEventId = NativeEventIds<'Focus' | 'Blur'>;
type NativeScrollEventId = NativeEventIds<'Scroll'>;
type NativeTransitionEventId = NativeEventIds<
  'TransitionRun' | 'TransitionStart' | 'TransitionEnd' | 'TransitionCancel'
>;
type NativePayloadById<
  Id extends number,
  Fields = Record<never, never>,
> = Id extends number ? NativeEventBase & Fields & { eventId: Id } : never;

export type NativeMouseEventPayload = NativePayloadById<
  NativeMouseEventId,
  {
    clientX: number;
    clientY: number;
    button: number;
    buttons: number;
    detail: number;
  }
>;

export type NativeKeyboardEventPayload = NativePayloadById<
  NativeKeyboardEventId,
  {
    key: string;
    keyChar?: string;
    repeat: boolean;
  }
>;

export type NativeTextEventPayload = NativePayloadById<
  NativeTextEventId,
  { value: string }
>;
export type NativeFocusEventPayload = NativePayloadById<NativeFocusEventId>;
export type NativeScrollEventPayload = NativePayloadById<
  NativeScrollEventId,
  { scrollX: number; scrollY: number }
>;
export type NativeTransitionEventPayload = NativePayloadById<
  NativeTransitionEventId,
  { propertyName: string; elapsedTime: number }
>;

export type NativeEventPayload =
  | NativeMouseEventPayload
  | NativeKeyboardEventPayload
  | NativeTextEventPayload
  | NativeFocusEventPayload
  | NativeScrollEventPayload
  | NativeTransitionEventPayload;

export type NativeWindowEventPayload =
  | { kind: 'resize'; width: number; height: number }
  | { kind: 'focus' | 'blur' | 'close' | 'reload' };

export type NativeTransportPayload =
  | { event: NativeEventPayload; window?: never }
  | { event?: never; window: NativeWindowEventPayload };

export class NativeRendererFatalError extends Error {
  constructor(
    message: string,
    readonly nativeFailure?: NativeBridgeFailure,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'NativeRendererFatalError';
  }
}

export interface NativeRendererBinding {
  readonly windowId: number;
  applyCommandBatch(buffer: Uint8Array): void;
  settle(): void;
  focusNode(id: number): void;
  blurNode(id: number): void;
  setSelectionRangeNode(id: number, start: number, end: number): void;
  selectNode(id: number): void;
  getSelectionNode(id: number): Promise<GpuiSelection>;
  scrollToNode(id: number, x: number, y: number): void;
  scrollByNode(id: number, x: number, y: number): void;
  scrollIntoViewNode(id: number): void;
  getScrollOffsetNode(id: number): Promise<GpuiScrollOffset>;
  measureNode(id: number): Promise<GpuiMeasurement>;
  reportFatal(javascriptStack: string): void;
  setWindowTitle(title: string): void;
  close(): void;
  isNodePresented(id: number): boolean;
  debugTreeJson(): string;
}

interface NativeAddon {
  NativeRendererBinding: new (
    rootId: number,
    headless: boolean,
    options?: NativeWindowOptions,
    onEvent?: (payload: NativeTransportPayload) => void
  ) => NativeRendererBinding;
  tick(): boolean;
}

const require = createRequire(import.meta.url);
const supportedTarget = /^(darwin|linux|win32)-(arm64|x64)$/;
let nativeAddon: NativeAddon | undefined;

const FAILURE_PREFIX = 'RETEND_GPUI_FAILURE:';

export function parseNativeBridgeFailure(
  error: unknown
): NativeBridgeFailure | null {
  const message = error instanceof Error ? error.message : String(error);
  const prefixIndex = message.indexOf(FAILURE_PREFIX);
  if (prefixIndex === -1) return null;
  const json = message.slice(prefixIndex + FAILURE_PREFIX.length);
  try {
    return JSON.parse(json) as NativeBridgeFailure;
  } catch {
    return null;
  }
}

export function loadNativeAddon(): NativeAddon {
  if (nativeAddon) return nativeAddon;
  const target = `${process.platform}-${process.arch}`;
  const localPath = fileURLToPath(
    new URL(
      `../../native/npm/${target}/retend-gpui-native.${target}.node`,
      import.meta.url
    )
  );
  if (fs.existsSync(localPath)) {
    nativeAddon = require(localPath) as NativeAddon;
    return nativeAddon;
  }

  if (!supportedTarget.test(target)) {
    throw new Error(`Retend GPUI does not support native target ${target}.`);
  }
  const packageName = `@retend-gpui/native-${target}`;
  try {
    nativeAddon = require(packageName) as NativeAddon;
    return nativeAddon;
  } catch (error) {
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' &&
      error.message.startsWith(`Cannot find module '${packageName}'`)
    ) {
      throw new Error(
        `Retend GPUI native binary is missing for ${target}. Run the native build or install ${packageName}.`,
        { cause: error }
      );
    }
    throw new Error(`Retend GPUI failed to load ${packageName}.`, {
      cause: error,
    });
  }
}
