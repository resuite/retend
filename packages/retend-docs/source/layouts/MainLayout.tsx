import { Await } from 'retend';
import { Link, Outlet } from 'retend/router';

export function MainLayout() {
  return (
    <div class="mx-auto max-w-[1140px] px-6 md:px-10">
      <Await>
        <nav class="flex items-center justify-between py-12">
          <Link
            class="text-fg text-xl tracking-tight"
            href="/"
            aria-label="Retend home"
          >
            retend
          </Link>
          <div class="flex gap-10" aria-label="Primary">
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
  );
}
