import { Toggle } from 'innate-ui';
import { Cell } from 'retend';

import { useThemeContext } from '@/scopes/theme';

/**
 * Dark mode switch. Innate UI owns the element, role and keyboard handling;
 * the look comes from `.theme-switch` in index.css, using the docs tokens.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeContext();
  const isDark = Cell.derived(() => theme.get() === 'dark');

  return (
    <Toggle
      value={isDark}
      onChange={toggleTheme}
      label="Dark mode"
      class="theme-switch"
    />
  );
}
