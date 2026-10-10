import { Cell, createScope, useScopeContext, type SourceCell } from 'retend';

/** Process-wide native system integration options for a Retend GPUI application. */
export interface GpuiSystemOptions {
  /**
   * Makes the native system titlebar transparent so application content can
   * extend behind the window controls. Supported by GPUI on macOS and Windows.
   */
  transparentTitlebar?: boolean;
}

/** Current operating-system light/dark preference. */
export type GpuiSystemTheme = 'light' | 'dark';

/** Reactive operating-system preferences shared by all GPUI windows. */
export interface GpuiSystem {
  /** Current system theme. Null until the native runtime reports it. */
  readonly theme: Cell<GpuiSystemTheme | null>;
  /**
   * Current system accent color as a CSS hex color.
   * Null when the platform does not expose an accent color or before detection.
   */
  readonly accentColor: Cell<string | null>;
}

/** @internal Mutable process-wide system preference state. */
export class RuntimeGpuiSystem implements GpuiSystem {
  readonly theme: SourceCell<GpuiSystemTheme | null>;
  readonly accentColor: SourceCell<string | null>;

  constructor() {
    this.theme = Cell.source(null);
    this.accentColor = Cell.source(null);
  }

  update(theme: GpuiSystemTheme, accentColor: string | null): void {
    Cell.batch(() => {
      if (this.theme.get() !== theme) this.theme.set(theme);
      this.updateAccent(accentColor);
    });
  }

  updateAccent(accentColor: string | null): void {
    if (this.accentColor.get() !== accentColor)
      this.accentColor.set(accentColor);
  }
}

/** Shared across every GPUI renderer in this application process. */
export const runtimeGpuiSystem = new RuntimeGpuiSystem();

/** @internal Scope provided at the root of every managed GPUI window. */
export const SystemScope = createScope<GpuiSystem>('retend-gpui:System');

/** Returns reactive process-wide operating-system preferences. */
export function useSystem(): GpuiSystem {
  return useScopeContext(SystemScope);
}
