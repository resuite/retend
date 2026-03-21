import { Cell } from 'retend';
import { serverResource } from 'retend-server';
import {
  getGlobalContext,
  resetGlobalContext,
  setGlobalContext,
} from 'retend/context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { timeout } from '../setup.tsx';

describe('serverResource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetGlobalContext();
    window.document.body.innerHTML = '';
  });

  it('dedupes matching server keys during SSR', async () => {
    setGlobalContext({
      globalData: new Map([['env:ssr', true]]),
    });
    const load = vi.fn(async () => {
      await timeout(10);
      return 'Ada';
    });
    const first = Cell.derivedAsync(async () => serverResource('user', load));
    const second = Cell.derivedAsync(async () => serverResource('user', load));
    const pending = Promise.all([first.get(), second.get()]);

    await vi.runAllTimersAsync();
    const values = await pending;

    expect(values).toEqual(['Ada', 'Ada']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('resumes from serialized data and refetches when the key changes', async () => {
    const name = Cell.source('Ada');
    const load = vi.fn(async (value) => {
      await timeout(10);
      return `Hello ${value}`;
    });
    setGlobalContext({
      globalData: new Map([['env:ssr', true]]),
    });
    const serverValue = Cell.derivedAsync(async (get) =>
      serverResource(['greeting', get(name)], () => load(get(name)))
    );
    const initial = serverValue.get();

    await vi.runAllTimersAsync();
    expect(await initial).toBe('Hello Ada');
    expect(load).toHaveBeenCalledTimes(1);

    const serialized = Object.fromEntries(
      getGlobalContext().globalData.get(Symbol.for('retend:server-data'))
    );

    setGlobalContext({
      globalData: new Map([
        [Symbol.for('retend:server-data'), new Map(Object.entries(serialized))],
      ]),
    });
    const clientValue = Cell.derivedAsync(async (get) =>
      serverResource(['greeting', get(name)], () => load(get(name)))
    );

    expect(await clientValue.get()).toBe('Hello Ada');
    expect(load).toHaveBeenCalledTimes(1);

    name.set('Lin');
    await vi.runAllTimersAsync();

    expect(await clientValue.get()).toBe('Hello Lin');
  });
});
