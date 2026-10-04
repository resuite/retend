import { Await } from 'retend';
import { Outlet } from 'retend/router';

import { ScrollRestoration } from '@/components/ScrollRestoration';
import { ThemeScope, useThemeData } from '@/scopes/theme';

import { Header } from './Header';

/**
 * Shared shell: theme, header and scroll handling. Each child route owns its
 * own width, so the landing page can run edge to edge inside its frame while
 * the docs keep their reading column.
 */
export function MainLayout() {
  const themeData = useThemeData();

  return (
    <ThemeScope.Provider value={themeData}>
      <ScrollRestoration />
      <Await>
        <Header />
        <main class="mt-(--header-height)">
          <Outlet />
        </main>
      </Await>
    </ThemeScope.Provider>
  );
}
