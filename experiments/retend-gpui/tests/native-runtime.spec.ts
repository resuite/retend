import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NativeRendererBinding } from '../source/native/addon';

vi.mock('../source/native/addon', () => ({
  loadNativeAddon: () => ({ tick: () => true }),
}));

import {
  acquireNativeRuntime,
  releaseNativeRuntime,
} from '../source/native/runtime';

function fakeBinding(
  isClosed: () => boolean,
  takeReloadRequested: () => boolean
): NativeRendererBinding {
  return {
    windowId: 1,
    applyCommandBatch() {},
    settle() {},
    takeReloadRequested,
    reportFatal() {},
    setWindowTitle() {},
    close() {},
    isClosed,
    isNodePresented: () => true,
    debugTreeJson: () => '{}',
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('native runtime lifecycle', () => {
  it('delivers reload requests and reports native close exactly once', async () => {
    vi.useFakeTimers();
    let closed = false;
    let reloadRequested = false;
    const binding = fakeBinding(
      () => closed,
      () => {
        const requested = reloadRequested;
        reloadRequested = false;
        return requested;
      }
    );
    const onClose = vi.fn();
    const onReload = vi.fn();
    acquireNativeRuntime(binding, onClose, onReload);

    reloadRequested = true;
    await vi.advanceTimersByTimeAsync(300);
    expect(onReload).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(onReload).toHaveBeenCalledOnce();

    closed = true;
    await vi.advanceTimersByTimeAsync(300);
    expect(onClose).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(300);
    expect(onClose).toHaveBeenCalledOnce();
    releaseNativeRuntime(binding);
  });
});
