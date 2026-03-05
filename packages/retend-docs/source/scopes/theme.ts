import { createScope, useScopeContext } from 'retend';
import { Cell } from 'retend';
import { useLocalStorage, useMatchMedia } from 'retend-utils/hooks';

export const ThemeScope = createScope<ThemeContext>('ThemeScope');
export type Theme = 'light' | 'dark';

export interface ThemeContext {
  theme: Cell<Theme>;
  toggleTheme: () => void;
}

export function useThemeData() {
  const isSystemDark = useMatchMedia('(prefers-color-scheme: dark)');
  const systemTheme = Cell.derived(() => {
    return isSystemDark.get() ? 'dark' : 'light';
  });
  const themeCell = useLocalStorage<Theme>('retend-theme', systemTheme.get());

  themeCell.listen((value) => {
    document.documentElement.classList.toggle('dark', value === 'dark');
  });

  const toggleTheme = () => {
    themeCell.set(themeCell.get() === 'light' ? 'dark' : 'light');
  };

  return { toggleTheme, theme: themeCell };
}

export function useThemeContext(): ThemeContext {
  return useScopeContext(ThemeScope);
}
