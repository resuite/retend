import { loadNativeAddon } from './addon.js';

/** Owns process liveness and the macOS GPUI event-pump lifetime. */
class NativeRuntime {
  readonly #pumpsNativeEvents = process.platform === 'darwin';
  #windows = 0;

  acquire(): void {
    if (this.#windows === 0 && this.#pumpsNativeEvents) {
      loadNativeAddon().startEventPump(() => {});
    }
    this.#windows++;
  }

  release(): void {
    // Hosts release at most once per acquire, so a release at zero means
    // native lifetime accounting has already gone wrong.
    if (this.#windows === 0) {
      throw new Error(
        'Retend GPUI released the native runtime more times than it was acquired.'
      );
    }
    this.#windows--;
    if (this.#windows === 0 && this.#pumpsNativeEvents) {
      loadNativeAddon().stopEventPump();
    }
  }
}

/** Process-wide native runtime shared by every GPUI window. */
export const nativeRuntime = new NativeRuntime();
