import {
  Cell,
  runPendingSetupEffects,
  setActiveRenderer,
  type __HMR_UpdatableFn,
} from 'retend';
import { setGlobalContext } from 'retend/context';
import {
  ESModulesEvaluator,
  ModuleRunner,
  createNodeImportMeta,
  type ModuleRunnerTransportHandlers,
} from 'vite/module-runner';

import { setAppContext, type GpuiApplication } from '../application.js';
import { RetendGpuiRenderer } from '../gpui-renderer.js';
import {
  createRuntimeWindow,
  WindowScope,
  type GpuiWindowOptions,
} from '../window.js';
import {
  isDevRuntimeInitMessage,
  isGpuiControlMessage,
  isViteIpcMessage,
  type DevRuntimeInitMessage,
  type GpuiControlMessage,
} from './protocol.js';

interface ApplicationModule {
  default?: new () => GpuiApplication<object>;
}

interface EntryModule {
  default?: unknown;
}

interface HotPayload {
  type?: string;
  err?: unknown;
}

interface WindowRecord {
  id: string;
  renderer: RetendGpuiRenderer;
  window: ReturnType<typeof createRuntimeWindow>;
}

function sendControl(message: GpuiControlMessage): void {
  if (!process.send) {
    throw new Error('The GPUI runtime IPC channel is unavailable.');
  }
  process.send(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runApplication(message: DevRuntimeInitMessage): Promise<void> {
  const globalData = new Map<PropertyKey, unknown>();
  const windows = new Map<string, WindowRecord>();
  let nextWindowId = 1;
  let runner: ModuleRunner | null = null;
  let application: GpuiApplication<object> | null = null;
  let shutdownPromise: Promise<void> | null = null;

  process.title = message.appName;
  setGlobalContext({ globalData });

  const closeWindow = (id: string): void => {
    const record = windows.get(id);
    if (!record) return;

    windows.delete(id);
    record.window.dispose();
    record.renderer.dispose();

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
      setAppContext({});
    }
  };

  const shutdown = (exitCode = 0): Promise<void> => {
    shutdownPromise ??= (async () => {
      process.off('message', onMessage);
      process.off('disconnect', onDisconnect);
      await cleanupApplication();

      for (const id of windows.keys()) closeWindow(id);

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

  const loadApplication = async (): Promise<void> => {
    const activeRunner = runner;
    if (!activeRunner)
      throw new Error('The GPUI module runner is unavailable.');

    const applicationModule = await activeRunner.import<ApplicationModule>(
      message.application
    );
    const Application = applicationModule.default;
    if (typeof Application !== 'function') {
      throw new TypeError(
        `The Retend GPUI application module must default-export an application class: ${message.application}`
      );
    }

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

  const entryTask = Cell.task(async (_input: void) => {
    const activeRunner = runner;
    if (!activeRunner)
      throw new Error('The GPUI module runner is unavailable.');

    const entryModule = await activeRunner.import<EntryModule>(message.entry);
    if (typeof entryModule.default !== 'function') {
      throw new TypeError(
        `The Retend GPUI entry module must default-export a component function: ${message.entry}`
      );
    }
    return entryModule.default as __HMR_UpdatableFn;
  });

  const showDevelopmentError = (error: unknown): void => {
    for (const record of windows.values()) {
      record.renderer.showDevelopmentError(error);
    }
  };

  const clearDevelopmentErrors = (): void => {
    for (const record of windows.values()) {
      record.renderer.clearDevelopmentError();
    }
  };

  const mountWindow = async (
    record: WindowRecord,
    Root: __HMR_UpdatableFn
  ): Promise<void> => {
    setActiveRenderer(record.renderer);
    record.renderer.clearDevelopmentError();
    record.renderer.render(() =>
      WindowScope.Provider({
        value: record.window,
        children: () => record.renderer.handleComponent(Root, []),
      })
    );
    await runPendingSetupEffects();
    record.renderer.flush();
    record.renderer.host.startFrameLoop();
  };

  const createWindowRecord = (options: GpuiWindowOptions): WindowRecord => {
    const id = String(nextWindowId++);
    const title = options.title ?? message.appName;
    const window = createRuntimeWindow(
      { width: options.width, height: options.height, title },
      {
        async open(_nextOptions) {
          throw new Error(
            'Opening additional windows is not supported by @gpuix/native 0.4.0.'
          );
        },
        close() {
          closeWindow(id);
        },
        setTitle(nextTitle) {
          windows.get(id)?.renderer.host.setWindowTitle(nextTitle);
        },
      }
    );
    const renderer = new RetendGpuiRenderer(undefined, {
      hmr: true,
      onWindowSize: ({ width, height }) => window.updateSize(width, height),
    });
    const record: WindowRecord = { id, renderer, window };

    const {
      location = '/',
      closeWithOpener: _closeWithOpener,
      ...nativeOptions
    } = options;
    nativeOptions.title = title;
    try {
      renderer.host.resetLocation(location);
      renderer.init(nativeOptions);
    } catch (error) {
      window.dispose();
      renderer.dispose();
      throw error;
    }

    windows.set(id, record);
    renderer.host.addEventListener('close', () => closeWindow(id), {
      once: true,
    });
    return record;
  };

  const recoverEntry = async (reload = false): Promise<void> => {
    let Root: __HMR_UpdatableFn | null;
    if (reload || !entryTask.pending.peek()) {
      Root = await entryTask.runWith(undefined);
    } else {
      Root = await entryTask.get();
    }

    const error = entryTask.error.peek();
    if (error || !Root) {
      const failure =
        error ?? new Error('The GPUI application entry is unavailable.');
      showDevelopmentError(failure);
      console.error('[retend-gpui] application entry failed:', failure);
      return;
    }

    for (const record of windows.values()) {
      if (!record.renderer.hasRoot) await mountWindow(record, Root);
      else record.renderer.clearDevelopmentError();
    }
  };

  const prepareFullReload = async (): Promise<void> => {
    await cleanupApplication();
    for (const record of windows.values()) record.renderer.unmount();
    globalData.clear();
  };

  const finishFullReload = async (): Promise<void> => {
    try {
      await loadApplication();
    } catch (error) {
      console.error('[retend-gpui] application reload failed:', error);
      await shutdown(1);
      return;
    }
    await recoverEntry(true);
  };

  const applyHotMessage = async (
    handlers: ModuleRunnerTransportHandlers,
    value: unknown
  ): Promise<void> => {
    const payload = value as HotPayload;
    if (payload.type === 'error') showDevelopmentError(payload.err ?? value);

    if (payload.type === 'full-reload') await prepareFullReload();
    await handlers.onMessage(value as never);

    if (payload.type === 'full-reload') {
      await finishFullReload();
    } else if (payload.type === 'update') {
      if (entryTask.error.peek()) await recoverEntry();
      else clearDevelopmentErrors();
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

    const Root = await entryTask.runWith(undefined);
    let entryError: unknown = entryTask.error.peek();
    if (entryError) {
      console.error('[retend-gpui] application entry failed:', entryError);
    }

    const initialRecord = createWindowRecord(message.options);

    if (!entryError && Root) {
      try {
        await mountWindow(initialRecord, Root);
      } catch (error) {
        entryError = error;
        initialRecord.renderer.unmount();
        console.error('[retend-gpui] application root failed:', error);
      }
    } else if (!entryError) {
      entryError = new Error('The GPUI application entry is unavailable.');
    }

    if (entryError) {
      initialRecord.renderer.showDevelopmentError(entryError);
      initialRecord.renderer.host.startFrameLoop();
    }

    sendControl({ channel: 'retend-gpui', type: 'application-ready' });
  } catch (error) {
    sendControl({
      channel: 'retend-gpui',
      type: 'application-startup-error',
      message: errorMessage(error),
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
