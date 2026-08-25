import { fork, type ChildProcess } from 'node:child_process';
import path from 'node:path';
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

/** Starts the single GPUI application child owned by a Vite development server. */
export function startDevApplication(
  root: string,
  api: RetendGpuiPluginApi
): DevApplicationProcess {
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
    if (intentionalExit || closePromise) done.resolve();
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

    if (intentionalExit || closePromise || code === 0) {
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
    appName: api.options.app.name,
    application: path.resolve(root, api.options.application),
    entry: path.resolve(root, api.options.entry),
    options: {
      ...api.options.window,
      title: api.options.window.title ?? api.options.app.name,
      location: api.options.window.location ?? '/',
    },
  } satisfies GpuiControlMessage);

  const close = (): Promise<void> => {
    closePromise ??= shutdown(child);
    return closePromise;
  };

  async function shutdown(activeChild: ChildProcess): Promise<void> {
    intentionalExit = true;
    if (activeChild.exitCode !== null || activeChild.signalCode !== null) {
      done.resolve();
      return;
    }

    const exited = new Promise<void>((resolve) =>
      activeChild.once('exit', () => resolve())
    );
    if (activeChild.connected) {
      try {
        activeChild.send({
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
