import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { RetendGpuiPluginApi } from '../plugins/vite.js';

import { isGpuiControlMessage, type GpuiControlMessage } from './protocol.js';

const FORCE_CLOSE_MS = 1_000;
const CHILD_ENTRY = fileURLToPath(new URL('./dev-child.js', import.meta.url));

export interface DevApplicationProcess {
  readonly ready: Promise<void>;
  readonly done: Promise<void>;
  close(): Promise<void>;
}

/**
 * Owns one development application child at a time.
 * Intentional Vite/config restarts replace the child; an unexpected active-child
 * failure rejects {@link done} so the dev server can terminate instead of hiding
 * the crash behind an automatic restart.
 */
export class DevApplicationSupervisor {
  readonly done: Promise<void>;
  readonly #done: PromiseWithResolvers<void>;
  readonly #startApplication: typeof startDevApplication;
  #application: DevApplicationProcess | null = null;
  #restartQueue: Promise<void> = Promise.resolve();
  #stopping = false;

  constructor(
    startApplication: typeof startDevApplication = startDevApplication
  ) {
    this.#startApplication = startApplication;
    this.#done = Promise.withResolvers<void>();
    this.done = this.#done.promise;
  }

  async start(root: string, api: RetendGpuiPluginApi): Promise<void> {
    if (this.#application) {
      throw new Error('The GPUI development application is already running.');
    }
    await this.#launch(root, api);
  }

  restart(root: string, api: RetendGpuiPluginApi): Promise<void> {
    if (this.#stopping) return Promise.resolve();

    this.#restartQueue = this.#restartQueue.then(async () => {
      const previous = this.#application;
      this.#application = null;
      await previous?.close();
      if (this.#stopping) return;
      await this.#launch(root, api);
    });

    const restart = this.#restartQueue.catch((error: unknown) => {
      if (!this.#stopping) {
        this.#done.reject(
          new Error('GPUI application restart failed.', { cause: error })
        );
      }
    });
    this.#restartQueue = restart;
    return restart;
  }

  stop(): void {
    if (this.#stopping) return;
    this.#stopping = true;
    this.#done.resolve();
    const application = this.#application;
    this.#application = null;
    const closing = application?.close() ?? Promise.resolve();
    this.#restartQueue = Promise.all([this.#restartQueue, closing]).then(
      () => undefined
    );
  }

  async close(): Promise<void> {
    this.stop();
    await this.#restartQueue;
  }

  async #launch(root: string, api: RetendGpuiPluginApi): Promise<void> {
    const next = this.#startApplication(root, api);
    this.#application = next;
    const terminal = next.done.then(
      () => ({ status: 'fulfilled' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error })
    );

    try {
      await next.ready;
    } catch (error) {
      if (this.#application === next) this.#application = null;
      if (this.#stopping) return;
      await next.close().catch(() => {});
      throw new Error('GPUI application startup failed.', { cause: error });
    }

    void terminal.then((result) => {
      if (this.#stopping || this.#application !== next) return;
      if (result.status === 'fulfilled') {
        this.#done.resolve();
      } else {
        this.#done.reject(
          new Error('GPUI application process failed.', { cause: result.error })
        );
      }
    });
  }
}

/** Starts the single GPUI application child owned by a Vite development server. */
export function startDevApplication(
  root: string,
  api: RetendGpuiPluginApi
): DevApplicationProcess {
  const launch = api.launch;
  if (!launch) {
    throw new Error('Retend GPUI Vite configuration has not been resolved.');
  }
  const child = fork(CHILD_ENTRY, [], {
    cwd: root,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  });
  const ready = Promise.withResolvers<void>();
  const done = Promise.withResolvers<void>();
  let intentionalExit = false;
  let closePromise: Promise<void> | null = null;

  const killIfRunning = (signal: NodeJS.Signals): void => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal);
  };

  const onChildError = (error: Error): void => {
    ready.reject(error);
    if (intentionalExit) done.resolve();
    else done.reject(error);
    killIfRunning('SIGTERM');
  };

  child.on('error', onChildError);
  child.on('message', (value: unknown) => {
    if (!isGpuiControlMessage(value)) return;
    const message = value;
    if (message.type === 'application-ready') {
      ready.resolve();
    } else if (message.type === 'application-startup-error') {
      ready.reject(new Error(message.message));
    }
  });

  child.once('exit', (code, signal) => {
    child.off('error', onChildError);
    const description = signal ?? code ?? 'unknown';
    ready.reject(
      new Error(
        `GPUI application exited before startup completed (${description}).`
      )
    );

    if (intentionalExit || code === 0) {
      done.resolve();
    } else {
      done.reject(
        new Error(`GPUI application process exited (${description}).`)
      );
    }
  });

  child.send({
    channel: 'retend-gpui',
    type: 'init',
    ...launch,
  } satisfies GpuiControlMessage);

  const close = (): Promise<void> => (closePromise ??= shutdown());

  async function shutdown(): Promise<void> {
    intentionalExit = true;
    if (child.exitCode !== null || child.signalCode !== null) {
      done.resolve();
      return;
    }

    const exited = new Promise<void>((resolve) =>
      child.once('exit', () => resolve())
    );
    if (child.connected) {
      try {
        child.send({
          channel: 'retend-gpui',
          type: 'close-application',
        } satisfies GpuiControlMessage);
      } catch {
        killIfRunning('SIGTERM');
      }
    } else {
      killIfRunning('SIGTERM');
    }

    const timer = setTimeout(() => killIfRunning('SIGKILL'), FORCE_CLOSE_MS);
    timer.unref();
    await exited;
    clearTimeout(timer);
    done.resolve();
  }

  api.hotChannel.attach(child);
  return { ready: ready.promise, done: done.promise, close };
}
