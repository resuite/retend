import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export interface NativeBridgeFailure {
  code: string;
  message: string;
  commandIndex?: number;
  offset?: number;
}

export interface NativeWindowOptions {
  title?: string;
  width?: number;
  height?: number;
}

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
  takeReloadRequested(): boolean;
  reportFatal(javascriptStack: string): void;
  setWindowTitle(title: string): void;
  close(): void;
  isClosed(): boolean;
  debugTreeJson(): string;
}

interface NativeAddon {
  NativeRendererBinding: new (
    rootId: number,
    headless: boolean,
    options?: NativeWindowOptions
  ) => NativeRendererBinding;
  tick(): boolean;
}

const require = createRequire(import.meta.url);
const supportedTarget = /^(darwin|linux|win32)-(arm64|x64)$/;

let cachedAddon: NativeAddon | undefined;
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
  if (cachedAddon) return cachedAddon;
  const target = `${process.platform}-${process.arch}`;
  const localPath = fileURLToPath(
    new URL(
      `../../native/npm/${target}/retend-gpui-native.${target}.node`,
      import.meta.url
    )
  );
  if (fs.existsSync(localPath))
    return (cachedAddon = require(localPath) as NativeAddon);

  if (!supportedTarget.test(target)) {
    throw new Error(`Retend GPUI does not support native target ${target}.`);
  }
  const packageName = `@retend-gpui/native-${target}`;
  try {
    return (cachedAddon = require(packageName) as NativeAddon);
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
