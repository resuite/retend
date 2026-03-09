import { Await } from 'retend';
import { Outlet } from 'retend/router';

import { ScrollRestoration } from '@/components/ScrollRestoration';
import { ThemeScope, useThemeData } from '@/scopes/theme';

import { Header } from './Header';

export function MainLayout() {
  const themeData = useThemeData();

  return (
    <ThemeScope.Provider value={themeData}>
      <ScrollRestoration />
      <Await>
        <Header />

        <div class="mt-(--header-height) pt-7 md:pt-14">
          <div class="mx-auto max-w-300 px-5 sm:px-6 md:px-10">
            <main class="flex flex-col gap-20 md:gap-35">
              <Outlet />
            </main>
          </div>
        </div>
      </Await>
    </ThemeScope.Provider>
  );
}
