import { Link } from 'retend/router';

import { ThemeToggle } from '@/components/ThemeToggle';
import { GithubIcon } from '@/icons';

import pkg from '../../../package.json';
import iconUrl from '../../assets/icon.svg';

export function Header() {
  return (
    <header class="border-line bg-paper/85 fixed top-0 right-0 left-0 z-50 flex h-(--header-height) flex-col justify-center border-b backdrop-blur-md">
      <div class="mx-auto flex w-full max-w-300 items-center justify-between gap-6 px-5 sm:px-8 md:px-10">
        <div class="flex items-center gap-3">
          <Link
            class="text-ink flex items-center gap-2.5 text-[1.1875rem] tracking-[-0.02em]"
            href="/"
            aria-label="Retend home"
          >
            <img src={iconUrl} alt="" class="h-6 w-6" />
            retend
          </Link>
          <a
            href="https://github.com/resuite/retend/releases"
            target="_blank"
            rel="noreferrer"
            class="border-line text-caption text-ink-soft hover:border-line-strong hover:text-ink hidden rounded-full border px-2 py-0.5 font-mono transition-colors sm:inline-block"
            aria-label={`v${pkg.version} release notes`}
          >
            v{pkg.version}
          </a>
        </div>

        <div class="flex items-center gap-4">
          <ThemeToggle />
          <a
            href="https://github.com/resuite/retend"
            target="_blank"
            rel="noreferrer"
            class="bg-ink text-small text-paper hover:bg-ink/85 focus-visible:outline-accent inline-flex h-9 items-center gap-2 rounded-full px-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <GithubIcon />
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
