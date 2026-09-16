#!/usr/bin/env node

import { createServer } from 'vite';

import {
  getRetendGpuiPluginApi,
  onRetendGpuiEnvironmentReady,
} from './plugins/vite.js';
import { DevApplicationSupervisor } from './runtime/supervisor.js';

async function runDev(): Promise<void> {
  const server = await createServer({ mode: 'development' });
  const supervisor = new DevApplicationSupervisor();
  let launcherWatch: ReturnType<typeof setInterval> | undefined;

  const stop = (): void => supervisor.stop();
  const detachEnvironmentReady = onRetendGpuiEnvironmentReady(
    server,
    ({ root, api }) => {
      void supervisor.restart(root, api);
    }
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

    await supervisor.start(server.config.root, api);
    console.log('[retend-gpui] ready');
    await supervisor.done;
  } finally {
    detachEnvironmentReady();
    if (launcherWatch) clearInterval(launcherWatch);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    process.off('SIGHUP', stop);
    await supervisor.close();
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
