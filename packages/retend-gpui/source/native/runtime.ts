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
    if (this.#windows === 0) return;
    this.#windows--;
    if (this.#windows === 0 && this.#pumpsNativeEvents) {
      loadNativeAddon().stopEventPump();
    }
  }
}

/** Process-wide native runtime shared by every GPUI window. */
export const nativeRuntime = new NativeRuntime();
