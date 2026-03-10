import type { JSX } from 'retend/jsx-runtime';

import { Cell } from 'retend';

import { useThemeContext } from '@/scopes/theme';

type NativeButtonProps = JSX.IntrinsicElements['button'];
interface ThemeToggleProps extends NativeButtonProps {}

export function ThemeToggle(props: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeContext();
  const isDark = Cell.derived(() => theme.get() === 'dark');
  const isLight = Cell.derived(() => !isDark.get());

  const { class: className, ...rest } = props;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      class={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none',
        {
          'border-brand bg-brand': isDark,
          'border-border bg-border': isLight,
        },
        className,
      ]}
      aria-label="Toggle dark mode"
      role="switch"
      {...rest}
    >
      <span
        class={[
          'inline-block h-4 w-4 rounded-full bg-white transition-transform',
          {
            'translate-x-5': isDark,
            'translate-x-0': isLight,
          },
        ]}
      />
    </button>
  );
}
