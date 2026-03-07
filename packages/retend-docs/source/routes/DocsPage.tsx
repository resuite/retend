/// <reference types="vite/client" />
import { useCurrentRoute } from 'retend/router';

import { createMDXComponents } from '@/components/MDXComponents';

import { docPages } from './docs/docsData';
import { DocsOnThisPage } from './docs/DocsOnThisPage';
import { DocsSidebar } from './docs/DocsSidebar';

export function DocsPage() {
  const currentRoute = useCurrentRoute();

  let activePath = currentRoute.get().path;
  if (activePath.endsWith('/')) {
    activePath = activePath.slice(0, -1);
  }

  let activePage = null;
  for (const docPage of docPages) {
    if (docPage.href !== activePath) continue;
    activePage = docPage;
    break;
  }

  if (!activePage) {
    return (
      <section class="mx-auto w-full max-w-300 px-5 sm:px-6 md:px-10">
        <h1 class="text-fg text-3xl tracking-tight">Page not found</h1>
      </section>
    );
  }

  const ActivePage = activePage.Component;
  const sectionHeadings = activePage.headings;
  let headingCursor = 0;
  const components = createMDXComponents({
    nextHeadingId(depth) {
      while (headingCursor < sectionHeadings.length) {
        const heading = sectionHeadings[headingCursor];
        headingCursor += 1;
        if (heading.depth === depth) return heading.id;
      }
    },
  });

  return (
    <section class="grid grid-cols-1 gap-10 text-balance lg:grid-cols-[220px_minmax(0,1fr)_200px] lg:gap-10">
      <DocsSidebar />

      <article class="docs-markdown min-w-0 text-pretty">
        <ActivePage components={components} />
      </article>

      <DocsOnThisPage sectionHeadings={sectionHeadings} />
    </section>
  );
}
