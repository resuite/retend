import { loadNativeAddon, type NativeRendererBinding } from './addon.js';

const bindings = new Map<NativeRendererBinding, (() => void) | undefined>();
const pumpsNativeEvents = process.platform === 'darwin';
let runtimeTimer: ReturnType<typeof setInterval> | null = null;

/** @internal Keeps Node alive while at least one real native window exists. */
export function acquireNativeRuntime(
  binding: NativeRendererBinding,
  onClose?: () => void
): void {
  bindings.set(binding, onClose);
  runtimeTimer ??= setInterval(runNativeRuntime, pumpsNativeEvents ? 8 : 250);
}

/** @internal Releases process liveness after a renderer/window tears down. */
export function releaseNativeRuntime(binding: NativeRendererBinding): void {
  bindings.delete(binding);
  runNativeRuntime();
}

function runNativeRuntime(): void {
  const running = !pumpsNativeEvents || loadNativeAddon().tick();
  for (const [binding, onClose] of bindings) {
    if (!binding.isClosed()) continue;
    bindings.delete(binding);
    onClose?.();
  }
  if (running && (pumpsNativeEvents || bindings.size > 0)) return;

  bindings.clear();
  if (runtimeTimer !== null) clearInterval(runtimeTimer);
  runtimeTimer = null;
}
