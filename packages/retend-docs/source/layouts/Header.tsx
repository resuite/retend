import { Link } from 'retend/router';

import { ThemeToggle } from '@/components/ThemeToggle';

export function Header() {
  return (
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
            <Link class="text-fg-muted text-sm md:text-[0.95rem]" href="/docs">
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
  );
}
