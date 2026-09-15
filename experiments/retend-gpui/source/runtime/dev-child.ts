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

function sendHotEvent(event: string): void {
  if (!process.send) return;
  process.send({
    channel: 'vite',
    payload: { type: 'custom', event, data: null },
  });
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

  let entryFailed = false;
  // Every call goes through the module runner instead of memoizing the entry
  // promise: the runner dedupes concurrent fetches and caches evaluated modules,
  // and it replays the same rejection until Vite invalidates the module, so
  // retries stay consistent. Readiness events can therefore fire once per call
  // rather than once per entry load; listeners only toggle a boolean per event.
  const loadEntry = async (): Promise<__HMR_UpdatableFn> => {
    try {
      const Root = await loadDefault<__HMR_UpdatableFn>(
        message.entry,
        'entry module must default-export a component function'
      );
      entryFailed = false;
      sendHotEvent('retend-gpui:entry-ready');
      return Root;
    } catch (error) {
      entryFailed = true;
      sendHotEvent('retend-gpui:entry-failed');
      throw error;
    }
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
      // Force the next update to re-import and remount the entry: a root that
      // rendered before throwing has no live invalidator to recover through.
      entryFailed = true;
    }
  };

  const createWindow = (
    options: DevRuntimeInitMessage['options']
  ): RuntimeGpuiWindow => {
    const renderer = new RetendGpuiRenderer({ hmr: true });

    try {
      renderer.init(options);
    } catch (error) {
      renderer.dispose();
      throw error;
    }

    const window = new RuntimeGpuiWindow(
      options.title,
      options.width ?? 800,
      options.height ?? 600,
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
    renderer.host.addEventListener('reload', () => {
      void recoverWindow(window).catch(console.error);
    });
    return window;
  };

  async function openWindow(
    options: GpuiWindowOptions
  ): Promise<GpuiWindowHandle> {
    const Root = await loadEntry();
    const window = createWindow({
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
      Root = await loadEntry();
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

  let hmrErrorGeneration = 0;
  const applyHotMessage = async (
    handlers: ModuleRunnerTransportHandlers,
    value: unknown
  ): Promise<void> => {
    const payload = value as HotPayload;
    if (payload.type === 'error') showDevelopmentError(payload.err ?? value);

    if (payload.type === 'full-reload') {
      try {
        await cleanupApplication();
        for (const window of windows) window.renderer.unmount();
        globalData.clear();
        runner?.clearCache();
        await loadApplication();
        await recoverEntry();
      } catch (error) {
        console.error('[retend-gpui] application reload failed:', error);
        await shutdown(1);
      }
      return;
    }

    const errorGeneration = hmrErrorGeneration;
    await handlers.onMessage(value as never);
    if (payload.type === 'update') {
      if (hmrErrorGeneration !== errorGeneration) return;
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

  let hotQueue: Promise<void> = Promise.resolve();
  const onMessage = (value: unknown): void => {
    if (isViteIpcMessage(value)) {
      const handlers = hotHandlers;
      if (!handlers) return;
      const payload = value.payload;
      // ModuleRunner imports use request/response RPC over the same IPC channel.
      // Responses must resolve immediately: queueing them behind an HMR task that
      // is itself awaiting an import would deadlock the reload.
      if (
        typeof payload === 'object' &&
        payload !== null &&
        Reflect.get(payload, 'type') === 'custom' &&
        Reflect.get(payload, 'event') === 'vite:invoke'
      ) {
        void handlers.onMessage(payload as never);
        return;
      }
      // Serialize application/HMR lifecycle work against later updates.
      hotQueue = hotQueue
        .then(() => applyHotMessage(handlers, payload))
        .catch((error: unknown) => {
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
        hmr: {
          logger: {
            error(error) {
              console.error(error);
              if (error instanceof Error) {
                hmrErrorGeneration++;
                showDevelopmentError(error);
              }
            },
            debug(...messages) {
              console.debug(...messages);
            },
          },
        },
      },
      new ESModulesEvaluator()
    );

    await loadApplication();

    const Root = await loadEntry().catch((error: unknown) => {
      console.error('[retend-gpui] application entry failed:', error);
      return undefined;
    });

    const initialWindow = createWindow(message.options);
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
