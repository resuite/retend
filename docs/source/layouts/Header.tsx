import { Link } from 'retend/router';

import { ThemeToggle } from '@/components/ThemeToggle';

import pkg from '../../../package.json';
import iconUrl from '../../assets/icon.svg';

export function Header() {
  return (
    <header class="bg-bg fixed top-0 right-0 left-0 z-50 flex h-(--header-height) flex-col justify-center border-b border-[#5c5c5c]">
      <div class="mx-auto w-full max-w-300 px-5 sm:px-6 md:px-10">
        <nav class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Link
              class="text-fg flex items-center gap-3 text-xl tracking-tight"
              href="/"
              aria-label="Retend home"
            >
              <img src={iconUrl} alt="Retend logo" class="h-6 w-6" />
              retend
            </Link>
            <a
              href="https://github.com/resuite/retend/releases"
              target="_blank"
              rel="noreferrer"
              class="text-fg-muted hover:text-fg flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors"
              aria-label={`v${pkg.version} release notes`}
            >
              v{pkg.version}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="opacity-70"
                aria-hidden="true"
              >
                <path
                  d="M2.5 4.5L6 8L9.5 4.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </a>
          </div>
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
