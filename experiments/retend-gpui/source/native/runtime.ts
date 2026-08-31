import { loadNativeAddon, type NativeRendererBinding } from './addon.js';

const bindings = new Set<NativeRendererBinding>();
const pumpsNativeEvents = process.platform === 'darwin';
let runtimeTimer: ReturnType<typeof setInterval> | null = null;

/** @internal Keeps Node alive while at least one real native window exists. */
export function acquireNativeRuntime(binding: NativeRendererBinding): void {
  bindings.add(binding);
  runtimeTimer ??= setInterval(runNativeRuntime, pumpsNativeEvents ? 8 : 250);
}

/** @internal Releases process liveness after a renderer/window tears down. */
export function releaseNativeRuntime(binding: NativeRendererBinding): void {
  bindings.delete(binding);
  runNativeRuntime();
}

function runNativeRuntime(): void {
  for (const binding of bindings) {
    if (binding.isClosed()) bindings.delete(binding);
  }

  const running = !pumpsNativeEvents || loadNativeAddon().tick();
  if (running && (pumpsNativeEvents || bindings.size > 0)) return;

  bindings.clear();
  if (runtimeTimer !== null) clearInterval(runtimeTimer);
  runtimeTimer = null;
}
