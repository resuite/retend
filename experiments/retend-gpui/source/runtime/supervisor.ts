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
