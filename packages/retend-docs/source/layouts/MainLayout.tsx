import { Await } from 'retend';
import { Link, Outlet } from 'retend/router';

import { ThemeToggle } from '@/components/ThemeToggle';
import { ThemeScope, useThemeData } from '@/scopes/theme';

export function MainLayout() {
  const themeData = useThemeData();

  return (
    <ThemeScope.Provider value={themeData}>
      <Await>
        <header class="bg-bg fixed top-0 right-0 left-0 z-50">
          <div class="mx-auto max-w-300 px-5 sm:px-6 md:px-10">
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
                  href="/quickstart"
                >
                  Quickstart
                </Link>
                <Link
                  class="text-fg-muted text-sm md:text-[0.95rem]"
                  href="/docs"
                >
                  Docs
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
          </div>
        </header>

        <div class="pt-32 md:pt-40">
          <div class="mx-auto max-w-300 px-5 sm:px-6 md:px-10">
            <main class="flex flex-col gap-20 pb-10 md:gap-35">
              <Outlet />
            </main>
          </div>
        </div>

        <footer class="relative mt-10 flex flex-col pt-32 sm:mt-20">
          <div class="relative z-10 mx-auto w-full max-w-285 px-5 sm:px-6 md:px-10">
            <div class="flex flex-col justify-between gap-16 lg:flex-row">
              <div class="flex flex-col justify-between gap-6">
                <Link
                  class="text-fg flex items-center gap-2 text-xl font-medium tracking-tight"
                  href="/"
                  aria-label="Retend home"
                >
                  retend
                </Link>
                <p class="text-fg-muted text-sm">
                  © 2026 Retend. All rights reserved.
                </p>
              </div>

              <div class="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-16">
                <div class="flex flex-col gap-4">
                  <h4 class="text-fg-muted text-sm font-medium">Framework</h4>
                  <Link
                    href="/quickstart"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Quickstart
                  </Link>
                  <Link
                    href="/concepts"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Concepts
                  </Link>
                  <Link
                    href="/api"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    API Reference
                  </Link>
                </div>
                <div class="flex flex-col gap-4">
                  <h4 class="text-fg-muted text-sm font-medium">Ecosystem</h4>
                  <Link
                    href="/router"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Router
                  </Link>
                  <Link
                    href="/server"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Server
                  </Link>
                  <Link
                    href="/utils"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Utils
                  </Link>
                </div>
                <div class="flex flex-col gap-4">
                  <h4 class="text-fg-muted text-sm font-medium">Resources</h4>
                  <a
                    href="https://github.com/adebola-io/retend"
                    target="_blank"
                    rel="noreferrer"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    GitHub
                  </a>
                  <a
                    href="https://npmjs.com/package/retend"
                    target="_blank"
                    rel="noreferrer"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    NPM
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="relative z-10 mt-20 flex justify-center overflow-hidden px-4 sm:mt-32">
            <h1
              class="from-fg/90 to-fg/5 bg-gradient-to-b bg-clip-text text-center text-[24vw] leading-none font-medium tracking-tighter text-transparent select-none"
              style={{ marginBottom: '-6.5vw' }}
            >
              retend
            </h1>
          </div>
        </footer>
      </Await>
    </ThemeScope.Provider>
  );
}
