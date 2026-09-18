import type { __HMR_UpdatableFn } from 'retend';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setGlobalContext } from 'retend/context';

import {
  setAppContext,
  clearAppContext,
  type GpuiApplication,
} from '../application.js';
import { setAssetBase } from '../assets.js';
import { RetendGpuiRenderer } from '../gpui-renderer.js';
import { setNativeAddonPath } from '../native/addon.js';
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

/** @internal Inputs baked into a packaged `retend-gpui` application entry. */
export interface ProductionAppDefinition<Context extends object> {
  /** Application class default-exported by the configured `application` module. */
  Application: new () => GpuiApplication<Context>;
  /** Root component default-exported by the configured `entry` module. */
  Root: __HMR_UpdatableFn;
  /** Application name used as the default window title. */
  appName: string;
  /** Initial window options resolved from the Vite plugin configuration. */
  options: ProductionWindowOptions;
  /** Absolute path to the bundled native addon. */
  nativeAddonPath?: string;
}

/** Finds the bundled addon in the app bundle or beside the entry. */
function resolveNativeAddonPath(explicit?: string): string | undefined {
  const target = `${process.platform}-${process.arch}`;
  const binaryName = `retend-gpui-native.${target}.node`;
  const bundleDir = fileURLToPath(new URL('.', import.meta.url));
  const executableDir = path.dirname(process.execPath);
  const candidates = [
    explicit,
    process.env.RETEND_GPUI_NATIVE_ADDON,
    path.join(bundleDir, 'native', binaryName),
    path.join(bundleDir, '..', 'Resources', 'native', binaryName),
    path.join(executableDir, 'native', binaryName),
    path.join(executableDir, '..', 'Resources', 'native', binaryName),
  ];
  return candidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && fs.existsSync(candidate)
  );
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
  const nativeAddonPath = resolveNativeAddonPath(definition.nativeAddonPath);
  if (nativeAddonPath) {
    setNativeAddonPath(nativeAddonPath);
  }
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
      renderer.init(options);
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
