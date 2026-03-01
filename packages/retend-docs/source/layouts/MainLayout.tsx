import { Await } from 'retend';
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
        <div class="mx-auto max-w-285 px-5 sm:px-6 md:px-10">
          <Await>
            <nav class="flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between md:py-12">
              <Link
                class="text-fg text-xl tracking-tight"
                href="/"
                aria-label="Retend home"
              >
                retend
              </Link>
              <div
                class="flex flex-wrap items-center gap-6 md:gap-10"
                aria-label="Primary"
              >
                <Link
                  class="text-fg-muted text-sm md:text-[0.95rem]"
                  href="/features"
                >
                  Features
                </Link>
                <Link
                  class="text-fg-muted text-sm md:text-[0.95rem]"
                  href="/quickstart"
                >
                  Quickstart
                </Link>
                <a
                  class="text-fg-muted text-sm md:text-[0.95rem]"
                  href="https://github.com/adebola-io/retend"
                  target="_blank"
                  rel="noreferrer"
                >
                  Github
                </a>
                <ThemeToggle />
              </div>
            </nav>

            <main class="flex flex-col gap-20 pb-20 md:gap-[140px] md:pb-30">
              <Outlet />
            </main>

            <footer class="border-border text-fg-muted flex flex-col gap-4 border-t pt-12 pb-10 text-[0.9rem] md:flex-row md:justify-between md:pt-20">
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
