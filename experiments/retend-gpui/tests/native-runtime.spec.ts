import { afterEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  tick: vi.fn(() => true),
}));

vi.mock('../source/native/addon', () => ({
  loadNativeAddon: () => ({ tick: native.tick }),
}));

import { nativeRuntime } from '../source/native/runtime';

afterEach(() => {
  vi.useRealTimers();
  native.tick.mockReset();
  native.tick.mockReturnValue(true);
});

describe('NativeRuntime', () => {
  it.runIf(process.platform === 'darwin')(
    'keeps pumping until the last acquired native window is released',
    () => {
      vi.useFakeTimers();
      nativeRuntime.acquire();
      nativeRuntime.acquire();

      vi.advanceTimersByTime(8);
      expect(native.tick).toHaveBeenCalledTimes(1);

      nativeRuntime.release();
      vi.advanceTimersByTime(8);
      expect(native.tick).toHaveBeenCalledTimes(2);

      nativeRuntime.release();
      nativeRuntime.release();
      vi.advanceTimersByTime(80);
      expect(native.tick).toHaveBeenCalledTimes(2);
    }
  );

  it.runIf(process.platform === 'darwin')(
    'stops pumping when the native application terminates',
    () => {
      vi.useFakeTimers();
      native.tick.mockReturnValue(false);
      nativeRuntime.acquire();

      vi.advanceTimersByTime(8);
      expect(native.tick).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(80);
      expect(native.tick).toHaveBeenCalledOnce();
    }
  );
});
