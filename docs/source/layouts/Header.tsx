import { Link } from 'retend/router';

import { ThemeToggle } from '@/components/ThemeToggle';

export function Header() {
  return (
    <header class="bg-bg fixed top-0 right-0 left-0 z-50 flex h-(--header-height) flex-col justify-center border-b border-[#5c5c5c]">
      <div class="mx-auto w-full max-w-300 px-5 sm:px-6 md:px-10">
        <nav class="flex items-center justify-between">
          <Link
            class="text-fg text-xl tracking-tight"
            href="/"
            aria-label="Retend home"
          >
            retend
          </Link>
          <ul class="flex items-center gap-6 md:gap-10" aria-label="Primary">
            <li>
              <Link
                class="text-fg-muted hover:text-brand text-[0.95rem] transition-colors"
                href="/docs"
              >
                Docs
              </Link>
            </li>
            <li class="hidden sm:block">
              <a
                class="text-fg-muted hover:text-brand text-[0.95rem] transition-colors"
                href="https://github.com/resuite/retend"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </li>
            <li>
              <ThemeToggle />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
