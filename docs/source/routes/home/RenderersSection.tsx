import { For } from 'retend';

import { AnyLink } from '@/components/AnyLink';

import { FRAME_PAD, GPUI_URL } from './constants';
import { IsoStack } from './IsoStack';

const packages = [
  { name: 'retend-web', href: '/docs/getting-started', external: false },
  { name: 'retend-gpui', href: GPUI_URL, external: true },
  {
    name: 'retend-server',
    href: '/docs/static-site-generation',
    external: false,
  },
];

const crosshairs = [
  'top-[14%] left-[10%]',
  'top-[14%] right-[8%]',
  'bottom-[12%] left-[10%]',
  'bottom-[12%] right-[8%]',
];

const EDGE = 'border-ink/45';

/**
 * The renderer section, drawn like a technical sheet: a framed board with a
 * tab, crop marks around the copy, and an exploded drawing on a cutting mat.
 */
export function RenderersSection() {
  return (
    <section
      aria-labelledby="home-renderers-title"
      class={['border-line border-t py-20 md:py-28', FRAME_PAD]}
    >
      <div class="relative pt-[47px]">
        <BoardTab />

        <div
          class={[
            'relative grid grid-cols-1 overflow-hidden rounded-tr-[22px] rounded-b-[22px] border lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]',
            EDGE,
          ]}
        >
          <div class="relative z-10 flex flex-col gap-12 px-6 pt-10 pb-12 sm:px-10 lg:py-16 lg:pl-14">
            <h2
              id="home-renderers-title"
              class="text-ink text-[clamp(1.75rem,2.8vw,2.25rem)] leading-[1.15] font-normal tracking-[-0.025em]"
            >
              Not just for the web.
            </h2>

            <div class="home-crop text-ink/60 max-w-md">
              <div class="bg-sunken text-ink">
                <p class="border-line border-b px-5 py-3 text-[1.0625rem] tracking-[-0.01em]">
                  One app, many renderers
                </p>
                <p class="text-body text-ink-soft px-5 pt-4 pb-6 leading-relaxed">
                  Retend was built without tying its programming model to the
                  browser. Build for the DOM today, a native GPUI window
                  tomorrow, or create a renderer for something entirely
                  different.
                </p>
              </div>
            </div>

            <AnyLink
              href="/docs/rendering-architecture"
              class="text-body text-ink decoration-line-strong hover:decoration-ink self-start underline underline-offset-4 motion-safe:transition-colors"
            >
              Read about the rendering architecture
            </AnyLink>
          </div>

          <div class="relative min-h-[24rem] lg:min-h-[36rem]">
            <div
              aria-hidden="true"
              class="home-grid home-grid-diagonal absolute inset-0"
            />
            {For(crosshairs, (position) => (
              <span
                aria-hidden="true"
                class={['text-ink/70 absolute size-5', position]}
              >
                <span class="absolute top-1/2 left-0 h-px w-full bg-current" />
                <span class="absolute top-0 left-1/2 h-full w-px bg-current" />
              </span>
            ))}
            <div class="relative flex h-full items-center justify-center px-6 py-14 sm:px-12">
              <div class="w-full max-w-[30rem]">
                <IsoStack />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The board's top edge: a raised tab holding the package links, then a slope
 * down to the board. Both cover the board's own top border.
 */
function BoardTab() {
  return (
    <div class="absolute top-0 left-0 z-10 flex h-[49px]">
      <div
        class={[
          'bg-paper flex items-center gap-1.5 rounded-tl-[22px] border-t border-l pr-2 pl-4 sm:pl-6',
          EDGE,
        ]}
      >
        <span class="text-small text-ink-soft pr-2 sm:hidden">Renderers</span>
        {For(packages, (pkg) => (
          <AnyLink
            href={pkg.href}
            external={pkg.external}
            class="border-line-strong bg-raised text-caption text-ink hover:border-ink focus-visible:outline-accent hidden rounded-lg border px-2.5 py-1 font-mono whitespace-nowrap focus-visible:outline-2 motion-safe:transition-colors sm:inline-block"
          >
            {pkg.name}
          </AnyLink>
        ))}
      </div>
      <svg
        aria-hidden="true"
        viewBox="0 0 48 49"
        class="h-[49px] w-12 shrink-0"
      >
        <path
          d="M0 0.5 C 18 0.5, 22 4, 26 24 S 34 47.5, 48 47.5 L 48 49 L 0 49 Z"
          class="fill-paper"
        />
        <path
          d="M0 0.5 C 18 0.5, 22 4, 26 24 S 34 47.5, 48 47.5"
          fill="none"
          class="stroke-ink/45"
          stroke-width="1"
        />
      </svg>
    </div>
  );
}
