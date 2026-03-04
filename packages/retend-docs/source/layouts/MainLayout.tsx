import { Await } from 'retend';
import { Outlet } from 'retend/router';

import { ThemeScope, useThemeData } from '@/scopes/theme';

import { Footer } from './Footer';
import { Header } from './Header';

export function MainLayout() {
  const themeData = useThemeData();

  return (
    <ThemeScope.Provider value={themeData}>
      <Await>
        <Header />

        <div class="pt-32 md:pt-40">
          <div class="mx-auto max-w-300 px-5 sm:px-6 md:px-10">
            <main class="flex flex-col gap-20 pb-10 md:gap-35">
              <Outlet />
            </main>
          </div>
        </div>

        <Footer />
      </Await>
    </ThemeScope.Provider>
  );
}
