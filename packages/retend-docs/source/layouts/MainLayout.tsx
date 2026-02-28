import { Await, Cell } from 'retend';
import { useLocalStorage, useMatchMedia } from 'retend-utils/hooks';
import { Link, Outlet } from 'retend/router';
import { createHighlighter } from 'shiki';

import { ThemeToggle } from '@/components/ThemeToggle';
import { HighlighterScope } from '@/scopes/highlighter';
import { ThemeScope, useThemeData } from '@/scopes/theme';
import { retendTheme } from '@/theme/shiki';

export function MainLayout() {
  const highlighter = createHighlighter({
    themes: [retendTheme],
    langs: ['tsx'],
  });
  const themeData = useThemeData();

  return (
    <ThemeScope.Provider value={themeData}>
      <HighlighterScope.Provider value={{ highlighter }}>
        <div class="mx-auto max-w-285 px-6 md:px-10">
          <Await>
            <nav class="flex items-center justify-between py-12">
              <Link
                class="text-fg text-xl tracking-tight"
                href="/"
                aria-label="Retend home"
              >
                retend
              </Link>
              <div class="flex items-center gap-10" aria-label="Primary">
                <Link
                  class="text-fg-muted hover:text-brand text-[0.95rem]"
                  href="/features"
                >
                  Features
                </Link>
                <Link
                  class="text-fg-muted hover:text-brand text-[0.95rem]"
                  href="/quickstart"
                >
                  Quickstart
                </Link>
                <a
                  class="text-fg-muted hover:text-brand text-[0.95rem]"
                  href="https://github.com/adebola-io/retend"
                  target="_blank"
                  rel="noreferrer"
                >
                  Github
                </a>
                <ThemeToggle />
              </div>
            </nav>

            <main class="flex flex-col gap-[140px] pb-30">
              <Outlet />
            </main>

            <footer class="border-border text-fg-muted flex justify-between border-t pt-20 pb-10 text-[0.9rem]">
              <p>© 2026 Retend</p>
              <a
                href="https://github.com/adebola-io/retend"
                target="_blank"
                rel="noreferrer"
              >
                Repository
              </a>
            </footer>
          </Await>
        </div>
      </HighlighterScope.Provider>
    </ThemeScope.Provider>
  );
}
