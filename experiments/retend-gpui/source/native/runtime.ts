import { loadNativeAddon } from './addon.js';

/** Owns process liveness and the macOS GPUI event pump. */
class NativeRuntime {
  readonly #pumpsNativeEvents = process.platform === 'darwin';
  #windows = 0;
  #timer: ReturnType<typeof setInterval> | null = null;

  acquire(): void {
    this.#windows++;
    if (this.#pumpsNativeEvents) {
      this.#timer ??= setInterval(() => this.#run(), 8);
    }
  }

  release(): void {
    if (this.#windows > 0) this.#windows--;
    if (this.#windows === 0) this.#stop();
  }

  #stop(): void {
    this.#windows = 0;
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
  }

  #run(): void {
    if (this.#windows > 0 && !loadNativeAddon().tick()) this.#stop();
  }
}

/** Process-wide native runtime shared by every GPUI window. */
export const nativeRuntime = new NativeRuntime();
