import type { JSX } from 'retend/jsx-runtime';

export type PanelTheme = 'light' | 'dark';

interface ThemePanelProps {
  theme: PanelTheme;
  class?: JSX.ValueOrCell<string | string[] | object>;
  children?: JSX.Template;
}

/**
 * Forces a theme for everything inside it, regardless of the page theme.
 * The tokens switch on `data-ds-theme`, so no `dark:` variants are needed.
 */
export function ThemePanel(props: ThemePanelProps) {
  const { theme, class: className, children } = props;

  return (
    <div
      data-ds-theme={theme}
      class={['bg-paper font-main text-ink', className]}
    >
      {children}
    </div>
  );
}
