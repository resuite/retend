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
type NativeImageEventId = NativeEventIds<'Load' | 'Error'>;
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
export type NativeImageEventPayload = NativePayloadById<NativeImageEventId>;

export type NativeEventPayload =
  | NativeMouseEventPayload
  | NativeKeyboardEventPayload
  | NativeTextEventPayload
  | NativeFocusEventPayload
  | NativeScrollEventPayload
  | NativeTransitionEventPayload
  | NativeImageEventPayload;

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

  startEventPump(notify: () => void): void;
  stopEventPump(): void;
  setApplicationIdentity(
    iconPath?: string,
    identifier?: string,
    name?: string
  ): void;
}

const require = createRequire(import.meta.url);
let nativeAddonPathOverride: string | undefined;
// Maps `${process.platform}-${process.arch}` onto the napi-rs platform strings
// used for binary and package names (`linux-x64-gnu`, `win32-x64-msvc`).
const nativePlatforms: Record<string, string> = {
  'darwin-arm64': 'darwin-arm64',
  'linux-arm64': 'linux-arm64-gnu',
  'linux-x64': 'linux-x64-gnu',
  'win32-arm64': 'win32-arm64-msvc',
  'win32-x64': 'win32-x64-msvc',
};
const supportedTargets = Object.keys(nativePlatforms);
const supportedTarget = new RegExp(`^(${supportedTargets.join('|')})$`);
let nativeAddon: NativeAddon | undefined;

export function nativeTargetPlatform(
  target = `${process.platform}-${process.arch}`
): string {
  const platform = nativePlatforms[target];
  if (!platform) {
    throw new Error(
      `Retend GPUI does not support native target ${target}. Supported targets are ${supportedTargets.join(', ')}.`
    );
  }
  return platform;
}

const FAILURE_PREFIX = 'RETEND_GPUI_FAILURE:';

function isMissingNativeBinary(
  error: unknown,
  packageName: string,
  target: string
): boolean {
  if (
    !(error instanceof Error) ||
    (error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND'
  ) {
    return false;
  }
  // The package is absent, or it resolved but its `.node` file is missing.
  return (
    error.message.startsWith(`Cannot find module '${packageName}'`) ||
    error.message.includes(`retend-gpui-native.${target}.node`)
  );
}

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

/** Points the loader at a bundled addon instead of package resolution. */
export function setNativeAddonPath(path: string | undefined): void {
  nativeAddonPathOverride = path;
}

export function loadNativeAddon(): NativeAddon {
  if (nativeAddon) return nativeAddon;
  if (nativeAddonPathOverride) {
    nativeAddon = require(nativeAddonPathOverride) as NativeAddon;
    return nativeAddon;
  }
  const target = `${process.platform}-${process.arch}`;
  const platform = nativeTargetPlatform(target);
  const localPath = fileURLToPath(
    new URL(
      `../../native/npm/${platform}/retend-gpui-native.${platform}.node`,
      import.meta.url
    )
  );
  if (fs.existsSync(localPath)) {
    nativeAddon = require(localPath) as NativeAddon;
    return nativeAddon;
  }

  if (!supportedTarget.test(target)) {
    throw new Error(
      `Retend GPUI does not support native target ${target}. Supported targets are ${supportedTargets.join(', ')}.`
    );
  }
  const packageName = `retend-gpui-native-${platform}`;
  try {
    nativeAddon = require(packageName) as NativeAddon;
    return nativeAddon;
  } catch (error) {
    if (isMissingNativeBinary(error, packageName, platform)) {
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

/**
 * Stages the process-wide application identity before the first window opens.
 * macOS uses the icon path for the development Dock icon; Windows uses the
 * identifier/name pair for the explicit AppUserModelID. No-op on platforms
 * without a native implementation.
 */
export function setApplicationIdentity(
  iconPath: string | null | undefined,
  identifier?: string | null,
  name?: string | null
): void {
  loadNativeAddon().setApplicationIdentity(
    iconPath ?? undefined,
    identifier ?? undefined,
    name ?? undefined
  );
}
