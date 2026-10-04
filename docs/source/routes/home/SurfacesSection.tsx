import type { JSX } from 'retend/jsx-runtime';

import { For } from 'retend';

import { AnyLink } from '@/components/AnyLink';

import { FRAME_PAD, GPUI_DOCS_URL } from './constants';
import { paintings } from './paintings';
import { ServerMock } from './ServerMock';
import { BrowserMock, WindowMock } from './SurfaceMocks';

interface Surface {
  place: string;
  title: string;
  pkg: string;
  bubble: string;
  href: string;
  external?: boolean;
  painting: string;
  /** Which part of the painting the card shows. */
  position: string;
  mock: () => JSX.Template;
  /** Fan position on wide screens. */
  fan: string;
}

interface SurfaceCardProps {
  surface: Surface;
}

const surfaces: Surface[] = [
  {
    place: 'Web',
    title: 'Build browser applications with retend-web',
    pkg: 'retend-web',
    bubble: 'bg-[#2f6fed] rounded-bl-md',
    href: '/docs/getting-started',
    painting: paintings.rousseau,
    position: 'object-[50%_30%]',
    mock: BrowserMock,
    fan: 'md:translate-y-8 md:-rotate-6',
  },
  {
    place: 'Desktop',
    title: 'Build native desktop applications with retend-gpui',
    pkg: 'retend-gpui',
    bubble: 'bg-[#23845a] rounded-br-md',
    href: GPUI_DOCS_URL,
    painting: paintings.vianen,
    position: 'object-[70%_50%]',
    mock: WindowMock,
    fan: 'md:z-[1] md:-translate-y-1',
  },
  {
    place: 'Server',
    title: 'Render pages ahead of time or on request with retend-server',
    pkg: 'retend-server',
    bubble: 'bg-[#1c1917] rounded-br-md',
    href: '/docs/static-site-generation',
    painting: paintings.tobias,
    position: 'object-[15%_40%]',
    mock: ServerMock,
    fan: 'md:translate-y-8 md:rotate-6',
  },
];

export function SurfacesSection() {
  return (
    <section
      aria-labelledby="home-surfaces-title"
      class={['border-line border-t py-20 md:py-28', FRAME_PAD]}
    >
      <h2
        id="home-surfaces-title"
        class="text-ink mx-auto text-center text-[clamp(1.75rem,2.8vw,2.25rem)] leading-[1.15] font-normal tracking-[-0.025em] text-balance"
      >
        Pick a surface. Start building.
      </h2>

      <ul class="mx-auto mt-14 grid max-w-[62rem] grid-cols-1 gap-6 md:mt-20 md:grid-cols-3 md:gap-3">
        {For(surfaces, (surface) => (
          <SurfaceCard surface={surface} />
        ))}
      </ul>

      <p class="text-body text-ink-soft mt-16 text-center md:mt-24">
        Somewhere else entirely?{' '}
        <AnyLink
          href="/docs/rendering-architecture"
          class="text-ink decoration-line-strong hover:decoration-ink underline underline-offset-4"
        >
          Build a renderer
        </AnyLink>{' '}
        and take Retend with you.
      </p>
    </section>
  );
}

function SurfaceCard(props: SurfaceCardProps) {
  const { surface } = props;
  const Mock = surface.mock;

  return (
    <li>
      <div class={['home-fan-card relative', surface.fan]}>
        <span
          aria-hidden="true"
          class={[
            'text-caption absolute -top-4 left-6 z-10 rounded-2xl px-3 py-1 font-mono text-white shadow-md md:-top-5',
            surface.bubble,
          ]}
        >
          {surface.pkg}
        </span>
        <AnyLink
          href={surface.href}
          external={surface.external}
          class="home-card bg-raised focus-visible:outline-accent flex flex-col overflow-hidden rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <div class="relative isolate flex h-52 items-end justify-center overflow-hidden px-6 pt-8">
            <img
              src={surface.painting}
              alt=""
              loading="lazy"
              class={[
                'home-painting absolute inset-0 -z-10 size-full object-cover',
                surface.position,
              ]}
            />
            <Mock />
          </div>
          <div class="flex flex-col gap-1.5 p-5">
            <span class="text-small text-ink-faint">{surface.place}</span>
            <span class="text-ink text-[1.0625rem] leading-snug tracking-[-0.01em] text-pretty">
              {surface.title}
            </span>
          </div>
        </AnyLink>
      </div>
    </li>
  );
}
