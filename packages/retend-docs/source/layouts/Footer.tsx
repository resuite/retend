import { Link } from 'retend/router';

export function Footer() {
  return (
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
              <ul class="flex flex-col gap-4">
                <li>
                  <Link
                    href="/quickstart"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Quickstart
                  </Link>
                </li>
                <li>
                  <Link
                    href="/concepts"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Concepts
                  </Link>
                </li>
                <li>
                  <Link
                    href="/api"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    API Reference
                  </Link>
                </li>
              </ul>
            </div>
            <div class="flex flex-col gap-4">
              <h4 class="text-fg-muted text-sm font-medium">Ecosystem</h4>
              <ul class="flex flex-col gap-4">
                <li>
                  <Link
                    href="/router"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Router
                  </Link>
                </li>
                <li>
                  <Link
                    href="/server"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Server
                  </Link>
                </li>
                <li>
                  <Link
                    href="/utils"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    Utils
                  </Link>
                </li>
              </ul>
            </div>
            <div class="flex flex-col gap-4">
              <h4 class="text-fg-muted text-sm font-medium">Resources</h4>
              <ul class="flex flex-col gap-4">
                <li>
                  <a
                    href="https://github.com/adebola-io/retend"
                    target="_blank"
                    rel="noreferrer"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://npmjs.com/package/retend"
                    target="_blank"
                    rel="noreferrer"
                    class="text-fg hover:text-brand text-sm transition-colors"
                  >
                    NPM
                  </a>
                </li>
              </ul>
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
  );
}
