import { describe, expect, it, vi } from 'vitest';

import type { RetendGpuiPluginApi } from '../source/plugins/vite';

import {
  DevApplicationSupervisor,
  type DevApplicationProcess,
} from '../source/runtime/supervisor';

interface ControlledProcess {
  process: DevApplicationProcess;
  ready: PromiseWithResolvers<void>;
  done: PromiseWithResolvers<void>;
  close: ReturnType<typeof vi.fn>;
}

function controlledProcess(): ControlledProcess {
  const ready = Promise.withResolvers<void>();
  const done = Promise.withResolvers<void>();
  const close = vi.fn(async () => {
    ready.reject(new Error('child closed'));
    done.resolve();
  });
  return {
    ready,
    done,
    close,
    process: { ready: ready.promise, done: done.promise, close },
  };
}

const api = {} as RetendGpuiPluginApi;

describe('development application supervision', () => {
  it('replaces the application on a Vite restart even when the plugin API object is reused', async () => {
    const first = controlledProcess();
    const second = controlledProcess();
    const start = vi
      .fn()
      .mockReturnValueOnce(first.process)
      .mockReturnValueOnce(second.process);
    const supervisor = new DevApplicationSupervisor(start);

    first.ready.resolve();
    await supervisor.start('/first', api);

    const restarting = supervisor.restart('/second', api);
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    second.ready.resolve();
    await restarting;

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(start.mock.calls).toEqual([
      ['/first', api],
      ['/second', api],
    ]);

    second.done.reject(new Error('child crashed'));
    await expect(supervisor.done).rejects.toThrow(
      'GPUI application process failed'
    );
    await supervisor.close();
  });

  it('does not lose a child completion that settles before readiness is observed', async () => {
    const child = controlledProcess();
    const supervisor = new DevApplicationSupervisor(() => child.process);

    child.ready.resolve();
    child.done.resolve();

    await supervisor.start('/app', api);
    await expect(supervisor.done).resolves.toBeUndefined();
    await supervisor.close();
  });

  it('treats replacement startup failure as a fatal restart failure', async () => {
    const first = controlledProcess();
    const second = controlledProcess();
    const start = vi
      .fn()
      .mockReturnValueOnce(first.process)
      .mockReturnValueOnce(second.process);
    const supervisor = new DevApplicationSupervisor(start);

    first.ready.resolve();
    await supervisor.start('/first', api);

    const restarting = supervisor.restart('/second', api);
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    second.ready.reject(new Error('bad configuration'));
    await restarting;

    await expect(supervisor.done).rejects.toThrow(
      'GPUI application restart failed'
    );
    expect(second.close).toHaveBeenCalledTimes(1);
    await supervisor.close();
  });

  it('allows a normal active application exit to end development cleanly', async () => {
    const child = controlledProcess();
    const supervisor = new DevApplicationSupervisor(() => child.process);

    child.ready.resolve();
    await supervisor.start('/app', api);
    child.done.resolve();

    await expect(supervisor.done).resolves.toBeUndefined();
    await supervisor.close();
  });

  it('closes a child immediately when development stops during startup', async () => {
    const child = controlledProcess();
    const supervisor = new DevApplicationSupervisor(() => child.process);
    const starting = supervisor.start('/app', api);

    supervisor.stop();

    await expect(starting).resolves.toBeUndefined();
    await expect(supervisor.done).resolves.toBeUndefined();
    expect(child.close).toHaveBeenCalledTimes(1);
    await supervisor.close();
  });
});
