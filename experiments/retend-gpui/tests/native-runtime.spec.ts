import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NativeRendererBinding } from '../source/native/addon';

vi.mock('../source/native/addon', () => ({
  loadNativeAddon: () => ({ tick: () => true }),
}));

import {
  acquireNativeRuntime,
  releaseNativeRuntime,
} from '../source/native/runtime';

function fakeBinding(isClosed: () => boolean): NativeRendererBinding {
  return {
    windowId: 1,
    applyCommandBatch() {},
    settle() {},
    reportFatal() {},
    setWindowTitle() {},
    close() {},
    isClosed,
    debugTreeJson: () => '{}',
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('native runtime lifecycle', () => {
  it('reports a natively closed binding exactly once', async () => {
    vi.useFakeTimers();
    let closed = false;
    const binding = fakeBinding(() => closed);
    const onClose = vi.fn();
    acquireNativeRuntime(binding, onClose);

    await vi.advanceTimersByTimeAsync(300);
    expect(onClose).not.toHaveBeenCalled();

    closed = true;
    await vi.advanceTimersByTimeAsync(300);
    expect(onClose).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(300);
    expect(onClose).toHaveBeenCalledOnce();
    releaseNativeRuntime(binding);
  });
});
