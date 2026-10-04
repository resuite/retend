import type { JSX } from 'retend/jsx-runtime';

import { For } from 'retend';

import type { PanelTheme } from './ThemePanel';

import { ThemePanel } from './ThemePanel';

interface ThemePairProps {
  render: (theme: PanelTheme) => JSX.Element;
  layout?: 'side' | 'stack';
}

const THEMES: PanelTheme[] = ['light', 'dark'];

/** Renders the same content once per theme so both can be compared at a glance. */
export function ThemePair(props: ThemePairProps) {
  const { render, layout = 'side' } = props;

  return (
    <div class={['grid gap-4', { 'lg:grid-cols-2': layout === 'side' }]}>
      {For(
        THEMES,
        (theme) => (
          <ThemePanel
            theme={theme}
            class="border-line min-w-0 rounded-xl border p-5 sm:p-6"
          >
            <p class="text-caption text-ink-faint mb-5 font-medium tracking-wider uppercase">
              {theme}
            </p>
            {render(theme)}
          </ThemePanel>
        ),
        { key: (theme) => theme }
      )}
    </div>
  );
}
