#!/usr/bin/env node

import { createServer } from 'vite';

import {
  getRetendGpuiPluginApi,
  onRetendGpuiEnvironmentReady,
  type RetendGpuiPluginApi,
} from './plugins/vite.js';
import {
  startDevApplication,
  type DevApplicationProcess,
} from './runtime/supervisor.js';

async function runDev(): Promise<void> {
  const server = await createServer({ mode: 'development' });
  const done = Promise.withResolvers<void>();
  let application: DevApplicationProcess | null = null;
  let currentApi: RetendGpuiPluginApi | null = null;
  let launcherWatch: ReturnType<typeof setInterval> | undefined;
  let stopping = false;
  let restartQueue = Promise.resolve();

  const launch = async (
    root: string,
    api: RetendGpuiPluginApi
  ): Promise<void> => {
    const next = startDevApplication(root, api);
    application = next;
    currentApi = api;
    let started = false;

    void next.done.then(
      () => {
        if (!stopping && application === next) done.resolve();
      },
      (error: unknown) => {
        if (stopping || application !== next) return;
        if (started) {
          console.error('[retend-gpui] application process failed:', error);
        }
        process.exitCode = 1;
        done.resolve();
      }
    );

    try {
      await next.ready;
      started = true;
    } catch (error) {
      console.error('[retend-gpui] application startup failed:', error);
      process.exitCode = 1;
    }
  };

  const replaceApplication = (root: string, api: RetendGpuiPluginApi): void => {
    if (stopping || api === currentApi) return;
    currentApi = api;
    restartQueue = restartQueue
      .then(async () => {
        const previous = application;
        application = null;
        await previous?.close();
        if (!stopping) await launch(root, api);
      })
      .catch((error: unknown) => {
        console.error('[retend-gpui] application restart failed:', error);
      });
  };

  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    done.resolve();
    void application?.close().catch((error: unknown) => {
      console.error('[retend-gpui] shutdown failed:', error);
    });
  };

  const detachEnvironmentReady = onRetendGpuiEnvironmentReady(({ root, api }) =>
    replaceApplication(root, api)
  );

  try {
    const api = getRetendGpuiPluginApi(server.config);
    const launcherPid = process.ppid;
    launcherWatch = setInterval(() => {
      if (process.ppid !== launcherPid) stop();
    }, 500);
    launcherWatch.unref();

    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    process.once('SIGHUP', stop);

    await launch(server.config.root, api);
    await done.promise;
  } finally {
    stopping = true;
    detachEnvironmentReady();
    if (launcherWatch) clearInterval(launcherWatch);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    process.off('SIGHUP', stop);
    await restartQueue;
    await (application as DevApplicationProcess | null)?.close();
    await server.close();
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== 'dev') {
    throw new Error(
      `Unknown retend-gpui command: ${command ?? '(none)'}. Expected \`dev\`.`
    );
  }
  await runDev();
}

main().catch((error: unknown) => {
  console.error('[retend-gpui]', error);
  process.exitCode = 1;
});
