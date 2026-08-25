/**
 * Process-wide lifecycle contract for a Vite-managed GPUI application.
 * The context object keeps the same identity from construction through cleanup.
 */
export interface GpuiApplication<Context extends object> {
  readonly context: Context;
  init(): void | Promise<void>;
  cleanup(): void | Promise<void>;
}

/** Registry augmented by the declaration generated from `retendGpui().application`. */
export interface GpuiAppContextTypes {
  default: object;
}

/** Context type exposed by the configured GPUI application. */
export type GpuiAppContext = GpuiAppContextTypes extends {
  application: infer Context extends object;
}
  ? Context
  : GpuiAppContextTypes['default'];

let applicationContext: object = {};

/** @internal Installs the context owned by the active application runtime. */
export function setAppContext(context: object): void {
  applicationContext = context;
}

/** Returns the process-wide context owned by the configured application. */
export function useAppContext(): GpuiAppContext {
  return applicationContext as GpuiAppContext;
}
