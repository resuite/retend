import type { __HMR_UpdatableFn } from 'retend';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setGlobalContext } from 'retend/context';

import type { GpuiSystemOptions } from '../system.js';

import {
  setAppContext,
  clearAppContext,
  type GpuiApplication,
} from '../application.js';
import { setAssetBase } from '../assets.js';
import { RetendGpuiRenderer } from '../gpui-renderer.js';
import { setApplicationIdentity, setNativeAddonPath } from '../native/addon.js';
import {
  RuntimeGpuiWindow,
  WindowScope,
  type GpuiWindowHandle,
  type GpuiWindowOptions,
} from '../window.js';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

type ProductionWindowOptions = GpuiWindowOptions &
  Required<Pick<GpuiWindowOptions, 'title' | 'location'>>;

/**
 * Inputs baked into a packaged `retend-gpui` application entry.
 *
 * Exported from `retend-gpui/runtime` for the entry the Vite plugin generates;
 * applications do not call {@link startProductionApp} themselves.
 */
export interface ProductionAppDefinition<Context extends object> {
  /** Application class default-exported by the configured `application` module. */
  Application: new () => GpuiApplication<Context>;
  /** Root component default-exported by the configured `entry` module. */
  Root: __HMR_UpdatableFn;
  /** Application name used as the default window title. */
  appName: string;
  /** Explicit Windows taskbar application identity. */
  identifier: string;
  /** Icon copied beside the production entry for Windows builds. */
  iconPath?: string;
  /** Process-wide native system integration options. */
  system?: GpuiSystemOptions;
  /** Initial window options resolved from the Vite plugin configuration. */
  options: ProductionWindowOptions;
  /** Path of the addon beside the bundled entry, `native/<binary>`. */
  nativeAddonPath: string;
}

/**
 * Locates the packaged addon in one of the layouts the packagers produce:
 * beside the bundled entry (`dist/<target>`), beside a Windows executable, or
 * in a macOS app's `Contents/Resources`. The executable-relative layouts cover
 * single-executable apps, where the entry's own URL is not a file on disk.
 *
 * A package without its own addon is broken. Falling back to ordinary package
 * resolution would load whatever addon Node finds instead, which on a
 * developer machine can hide the missing file, so this throws.
 */
function resolveNativeAddonPath(besideEntry: string): string {
  const binaryName = path.basename(besideEntry);
  const executableDir = path.dirname(process.execPath);
  const candidates = [
    besideEntry,
    path.join(executableDir, 'native', binaryName),
    path.join(executableDir, '..', 'Resources', 'native', binaryName),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `Retend GPUI could not find the packaged native addon ${binaryName}. Looked in:\n${candidates.join('\n')}`
    );
  }
  return found;
}

/** Directory holding emitted assets: Resources in an app, else the bundle dir. */
function resolveAssetBase(): string {
  const bundleDir = fileURLToPath(new URL('.', import.meta.url));
  const executableDir = path.dirname(process.execPath);
  const candidates = [
    bundleDir,
    path.join(executableDir, '..', 'Resources'),
    executableDir,
  ];
  return (
    candidates.find((directory) =>
      fs.existsSync(path.join(directory, 'assets'))
    ) ?? bundleDir
  );
}

/** Production boot: no module runner, HMR, or reload recovery. */
export async function startProductionApp<Context extends object>(
  definition: ProductionAppDefinition<Context>
): Promise<void> {
  setNativeAddonPath(resolveNativeAddonPath(definition.nativeAddonPath));
  setApplicationIdentity(
    definition.iconPath,
    definition.identifier,
    definition.appName
  );
  setAssetBase(resolveAssetBase());

  const globalData = new Map<PropertyKey, unknown>();
  const windows = new Set<RuntimeGpuiWindow>();
  setGlobalContext({ globalData });

  const instance = new definition.Application();
  const initialContext = instance.context;
  if (
    typeof initialContext !== 'object' ||
    initialContext === null ||
    Array.isArray(initialContext)
  ) {
    throw new TypeError('The GPUI application context must be an object.');
  }
  await instance.init();
  if (instance.context !== initialContext) {
    throw new Error(
      'The GPUI application must not replace its context object during init().'
    );
  }
  setAppContext(initialContext);

  let shutdownPromise: Promise<void> | null = null;
  const shutdown = (exitCode = 0): Promise<void> => {
    shutdownPromise ??= (async () => {
      try {
        await instance.cleanup();
      } catch (error) {
        console.error('[retend-gpui] application cleanup failed:', error);
      } finally {
        clearAppContext();
      }
      process.exit(exitCode);
    })();
    return shutdownPromise;
  };

  const closeWindow = (window: RuntimeGpuiWindow): void => {
    if (!windows.delete(window)) return;
    window.dispose();
    window.renderer.dispose();
    if (windows.size === 0 && !shutdownPromise) void shutdown();
  };

  function openWindow(options: GpuiWindowOptions): Promise<GpuiWindowHandle> {
    const window = createWindow({
      ...options,
      title: options.title ?? definition.appName,
      location: options.location ?? '/',
    });
    return mountWindow(window).then(() => window.handle);
  }

  const createWindow = (
    options: ProductionWindowOptions
  ): RuntimeGpuiWindow => {
    const renderer = new RetendGpuiRenderer();
    try {
      renderer.init(options, definition.system);
    } catch (error) {
      renderer.dispose();
      throw error;
    }

    const window = new RuntimeGpuiWindow(
      options.title,
      options.width ?? DEFAULT_WIDTH,
      options.height ?? DEFAULT_HEIGHT,
      renderer,
      { close: closeWindow, open: openWindow }
    );
    windows.add(window);
    renderer.host.addEventListener(
      'close',
      () => {
        // Close arrives while GPUI holds its borrow; defer teardown out of the pump.
        setTimeout(() => closeWindow(window), 0);
      },
      { once: true }
    );
    return window;
  };

  const mountWindow = async (window: RuntimeGpuiWindow): Promise<void> => {
    await window.renderer.mount(() =>
      WindowScope.Provider({
        value: window,
        children: () => window.renderer.handleComponent(definition.Root, []),
      })
    );
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  const initialWindow = createWindow(definition.options);
  await mountWindow(initialWindow);
}
