import { afterEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  startEventPump: vi.fn(),
  stopEventPump: vi.fn(),
}));

vi.mock('../source/native/addon', () => ({
  loadNativeAddon: () => native,
}));

import { nativeRuntime } from '../source/native/runtime';

afterEach(() => {
  native.startEventPump.mockReset();
  native.stopEventPump.mockReset();
});

describe.runIf(process.platform === 'darwin')('NativeRuntime', () => {
  it('starts the native pump once while any window is acquired', () => {
    nativeRuntime.acquire();
    nativeRuntime.acquire();
    expect(native.startEventPump).toHaveBeenCalledTimes(1);

    nativeRuntime.release();
    expect(native.stopEventPump).not.toHaveBeenCalled();

    nativeRuntime.release();
    expect(native.stopEventPump).toHaveBeenCalledTimes(1);
  });

  it('restarts the native pump after the last window is released', () => {
    nativeRuntime.acquire();
    nativeRuntime.release();
    nativeRuntime.acquire();
    expect(native.startEventPump).toHaveBeenCalledTimes(2);
    expect(native.stopEventPump).toHaveBeenCalledTimes(1);
    nativeRuntime.release();
  });
});
