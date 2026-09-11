import { type __HMR_UpdatableFn } from 'retend';
import { setGlobalContext } from 'retend/context';
import {
  ESModulesEvaluator,
  ModuleRunner,
  createNodeImportMeta,
  type ModuleRunnerTransportHandlers,
} from 'vite/module-runner';

import {
  clearAppContext,
  setAppContext,
  type GpuiApplication,
} from '../application.js';
import { RetendGpuiRenderer } from '../gpui-renderer.js';
import { NativeRendererFatalError } from '../native/addon.js';
import {
  RuntimeGpuiWindow,
  WindowScope,
  type GpuiWindowHandle,
  type GpuiWindowOptions,
} from '../window.js';
import {
  isDevRuntimeInitMessage,
  isGpuiControlMessage,
  isViteIpcMessage,
  type DevRuntimeInitMessage,
  type GpuiControlMessage,
} from './protocol.js';

interface HotPayload {
  type?: string;
  err?: unknown;
}

function sendControl(message: GpuiControlMessage): void {
  if (!process.send) {
    throw new Error('The GPUI runtime IPC channel is unavailable.');
  }
  process.send(message);
}

async function runApplication(message: DevRuntimeInitMessage): Promise<void> {
  const globalData = new Map<PropertyKey, unknown>();
  const windows = new Set<RuntimeGpuiWindow>();
  let runner: ModuleRunner | null = null;
  let application: GpuiApplication<object> | null = null;
  let shutdownPromise: Promise<void> | null = null;

  process.title = message.appName;
  setGlobalContext({ globalData });

  const closeWindow = (window: RuntimeGpuiWindow): void => {
    if (!windows.delete(window)) return;
    window.dispose();
    window.renderer.dispose();
    if (windows.size === 0 && !shutdownPromise) void shutdown();
  };

  const cleanupApplication = async (): Promise<void> => {
    const current = application;
    application = null;
    if (!current) return;
    try {
      await current.cleanup();
    } catch (error) {
      console.error('[retend-gpui] application cleanup failed:', error);
    } finally {
      clearAppContext();
    }
  };

  const shutdown = (exitCode = 0): Promise<void> => {
    shutdownPromise ??= (async () => {
      process.off('message', onMessage);
      process.off('disconnect', onDisconnect);
      await cleanupApplication();

      for (const window of windows) closeWindow(window);

      try {
        await runner?.close();
      } catch (error) {
        console.error('[retend-gpui] module runner shutdown failed:', error);
      }
      runner = null;
      process.exit(exitCode);
    })();
    return shutdownPromise;
  };

  async function loadDefault<T extends Function>(
    path: string,
    description: string
  ): Promise<T> {
    if (!runner) throw new Error('The GPUI module runner is unavailable.');
    const module = await runner.import<Record<string, unknown>>(path);
    if (typeof module.default !== 'function') {
      throw new TypeError(`The Retend GPUI ${description}: ${path}`);
    }
    return module.default as T;
  }

  const loadApplication = async (): Promise<void> => {
    const Application = await loadDefault<new () => GpuiApplication<object>>(
      message.application,
      'application module must default-export an application class'
    );
    const instance = new Application();
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
    application = instance;
    setAppContext(initialContext);
  };

  let entry: Promise<__HMR_UpdatableFn> | undefined;
  let entryFailed = false;
  const loadEntry = (reload = false): Promise<__HMR_UpdatableFn> => {
    if (!reload && entry) return entry;
    entryFailed = false;
    const pending = loadDefault<__HMR_UpdatableFn>(
      message.entry,
      'entry module must default-export a component function'
    );
    entry = pending;
    void pending.catch(() => {
      if (entry === pending) entryFailed = true;
    });
    return pending;
  };

  const showDevelopmentError = (
    error: unknown,
    targets: Iterable<RuntimeGpuiWindow> = windows
  ): void => {
    for (const window of targets) {
      try {
        window.renderer.showDevelopmentError(error);
      } catch (cause) {
        if (!(cause instanceof NativeRendererFatalError)) throw cause;
      }
    }
  };

  const recoverWindow = async (
    window: RuntimeGpuiWindow,
    Root?: __HMR_UpdatableFn
  ): Promise<void> => {
    if (Root === undefined) {
      try {
        Root = await loadEntry();
      } catch (error) {
        showDevelopmentError(error, [window]);
        return;
      }
    }

    try {
      const Component = Root;
      window.renderer.clearDevelopmentError();
      await window.renderer.mount(() =>
        WindowScope.Provider({
          value: window,
          children: () => window.renderer.handleComponent(Component, []),
        })
      );
    } catch (error) {
      if (error instanceof NativeRendererFatalError) return;
      try {
        window.renderer.unmount();
      } catch (cause) {
        if (cause instanceof NativeRendererFatalError) return;
        throw cause;
      }
      showDevelopmentError(error, [window]);
      console.error('[retend-gpui] application root failed:', error);
    }
  };

  const createWindow = async (
    options: DevRuntimeInitMessage['options']
  ): Promise<RuntimeGpuiWindow> => {
    const renderer = new RetendGpuiRenderer({ hmr: true });
    renderer.host.resetLocation(options.location);

    const initialSize = Promise.withResolvers<readonly [number, number]>();
    const onInitialResize = (event: Event): void => {
      const { width, height } = (event as CustomEvent).detail;
      initialSize.resolve([width, height]);
    };
    const onInitialClose = (): void => {
      renderer.host.removeEventListener('resize', onInitialResize);
      initialSize.reject(
        new Error('The native GPUI window closed during creation.')
      );
    };
    renderer.host.addEventListener('resize', onInitialResize, { once: true });
    renderer.host.addEventListener('close', onInitialClose, { once: true });

    try {
      renderer.init(options);
    } catch (error) {
      renderer.host.removeEventListener('resize', onInitialResize);
      renderer.host.removeEventListener('close', onInitialClose);
      renderer.dispose();
      throw error;
    }

    const [width, height] = await initialSize.promise;
    if (!renderer.host.isInitialized) {
      renderer.dispose();
      throw new Error('The native GPUI window closed during creation.');
    }

    const window = new RuntimeGpuiWindow(
      options.title,
      width,
      height,
      renderer,
      { close: closeWindow, open: openWindow }
    );
    windows.add(window);
    renderer.host.addEventListener(
      'close',
      () => {
        // Native `close` is delivered synchronously while GPUI is pumping its
        // event loop and holding the application borrow. Disposing the window
        // here would call back into the native app and re-enter that borrow
        // (RefCell already borrowed), so defer teardown out of the pump.
        setTimeout(() => closeWindow(window), 0);
      },
      { once: true }
    );
    renderer.host.removeEventListener('close', onInitialClose);
    renderer.host.addEventListener('reload', () => {
      void recoverWindow(window).catch(console.error);
    });
    renderer.host.addEventListener('applicationerror', (event) => {
      showDevelopmentError((event as CustomEvent<unknown>).detail, [window]);
    });
    return window;
  };

  async function openWindow(
    options: GpuiWindowOptions
  ): Promise<GpuiWindowHandle> {
    const Root = await loadEntry();
    const window = await createWindow({
      ...options,
      title: options.title ?? message.appName,
      location: options.location ?? '/',
    });
    await recoverWindow(window, Root);
    return window.handle;
  }

  const recoverEntry = async (): Promise<void> => {
    let Root: __HMR_UpdatableFn;
    try {
      Root = await loadEntry(true);
    } catch (error) {
      showDevelopmentError(error);
      console.error('[retend-gpui] application entry failed:', error);
      return;
    }
    for (const window of windows) {
      if (!window.renderer.hasRoot) await recoverWindow(window, Root);
      else window.renderer.clearDevelopmentError();
    }
  };

  const applyHotMessage = async (
    handlers: ModuleRunnerTransportHandlers,
    value: unknown
  ): Promise<void> => {
    const payload = value as HotPayload;
    if (payload.type === 'error') showDevelopmentError(payload.err ?? value);

    if (payload.type === 'full-reload') {
      await cleanupApplication();
      for (const window of windows) window.renderer.unmount();
      globalData.clear();
    }
    await handlers.onMessage(value as never);

    if (payload.type === 'full-reload') {
      try {
        await loadApplication();
      } catch (error) {
        console.error('[retend-gpui] application reload failed:', error);
        await shutdown(1);
        return;
      }
      await recoverEntry();
    } else if (payload.type === 'update') {
      if (entryFailed) await recoverEntry();
      else
        for (const window of windows) window.renderer.clearDevelopmentError();
    }
  };

  let hotHandlers: ModuleRunnerTransportHandlers | null = null;
  const transport = {
    connect(handlers: ModuleRunnerTransportHandlers) {
      hotHandlers = handlers;
    },
    disconnect() {
      hotHandlers = null;
    },
    send(payload: unknown) {
      if (process.send) process.send({ channel: 'vite', payload });
    },
  };

  const onMessage = (value: unknown): void => {
    if (isViteIpcMessage(value)) {
      const handlers = hotHandlers;
      if (!handlers) return;
      void applyHotMessage(handlers, value.payload).catch((error: unknown) => {
        showDevelopmentError(error);
        console.error('[retend-gpui] HMR failed:', error);
      });
      return;
    }

    if (isGpuiControlMessage(value) && value.type === 'close-application') {
      void shutdown();
    }
  };

  const onDisconnect = (): void => {
    const handlers = hotHandlers;
    void shutdown(typeof process.exitCode === 'number' ? process.exitCode : 0);
    handlers?.onDisconnection();
  };

  process.on('message', onMessage);
  process.on('disconnect', onDisconnect);

  try {
    runner = new ModuleRunner(
      {
        transport,
        createImportMeta: createNodeImportMeta,
      },
      new ESModulesEvaluator()
    );

    await loadApplication();

    const Root = await loadEntry().catch((error: unknown) => {
      console.error('[retend-gpui] application entry failed:', error);
      return undefined;
    });

    const initialWindow = await createWindow(message.options);
    await recoverWindow(initialWindow, Root);

    sendControl({ channel: 'retend-gpui', type: 'application-ready' });
  } catch (error) {
    sendControl({
      channel: 'retend-gpui',
      type: 'application-startup-error',
      message: error instanceof Error ? error.message : String(error),
    });
    await shutdown(1);
  }
}

function onInitMessage(value: unknown): void {
  if (!isDevRuntimeInitMessage(value)) return;
  process.off('message', onInitMessage);
  void runApplication(value);
}

process.on('message', onInitMessage);
