import { For } from 'retend';

import { AnyLink } from '@/components/AnyLink';

import { FRAME_PAD, GPUI_DOCS_URL } from './constants';

interface Entry {
  title: string;
  body: string;
  href: string;
  external?: boolean;
}

const entries: Entry[] = [
  {
    title: 'Getting started',
    body: 'Create a project and render your first component.',
    href: '/docs/getting-started',
  },
  {
    title: 'Reactivity and Cells',
    body: 'Source values, derived values, and how updates travel.',
    href: '/docs/reactivity-and-cells',
  },
  {
    title: 'JSX and components',
    body: 'Write components as functions and compose them.',
    href: '/docs/jsx-and-components',
  },
  {
    title: 'Routing',
    body: 'Define routes, nest layouts, and move between pages.',
    href: '/docs/defining-routes',
  },
  {
    title: 'Rendering architecture',
    body: 'How Retend talks to a renderer, and how to write one.',
    href: '/docs/rendering-architecture',
  },
  {
    title: 'GPUI',
    body: 'Build and package native desktop apps with retend-gpui.',
    href: GPUI_DOCS_URL,
  },
];

export function DocsSection() {
  return (
    <section
      aria-labelledby="home-docs-title"
      class={[
        'border-line grid grid-cols-1 gap-8 border-t py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12 md:py-20',
        FRAME_PAD,
      ]}
    >
      <h2
        id="home-docs-title"
        class="text-ink text-[1.5rem] leading-tight font-normal tracking-[-0.02em]"
      >
        Read the docs
      </h2>
      <ul class="border-line grid grid-cols-1 border-t sm:grid-cols-2 sm:gap-x-10">
        {For(entries, (entry) => (
          <li class="border-line border-b">
            <AnyLink
              href={entry.href}
              external={entry.external}
              class="group focus-visible:outline-accent flex items-start justify-between gap-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span class="flex flex-col gap-0.5">
                <span class="text-ink text-[1.0625rem]">{entry.title}</span>
                <span class="text-small text-ink-faint">{entry.body}</span>
              </span>
              <span
                aria-hidden="true"
                class="text-ink-faint group-hover:text-ink pt-0.5 motion-safe:transition-colors"
              >
                ›
              </span>
            </AnyLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
