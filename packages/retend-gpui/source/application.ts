import { getGlobalContext } from 'retend/context';

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

/** @internal Installs the context owned by the active application runtime. */
export function setAppContext(context: object): void {
  getGlobalContext().globalData.set('retend-gpui:application-context', context);
}

/** @internal Removes the context when the owning application runtime is cleaned up. */
export function clearAppContext(): void {
  getGlobalContext().globalData.delete('retend-gpui:application-context');
}

/** Returns the process-wide context owned by the configured application. */
export function useAppContext(): GpuiAppContext {
  const context = getGlobalContext().globalData.get(
    'retend-gpui:application-context'
  );
  if (!context) {
    throw new Error('useAppContext() requires an active GPUI application.');
  }
  return context as GpuiAppContext;
}
