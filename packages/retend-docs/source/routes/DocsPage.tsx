/// <reference types="vite/client" />
import { Cell, onConnected } from 'retend';
import { useCurrentRoute } from 'retend/router';

import { createMDXComponents } from '@/components/MDXComponents';

import { docPages } from './docs/docsData';
import { DocsOnThisPage } from './docs/DocsOnThisPage';
import { DocsSidebar } from './docs/DocsSidebar';

type DocsHeading = { id: string; label: string; depth: number };

export function DocsPage() {
  const currentRoute = useCurrentRoute();
  const articleRef = Cell.source<HTMLElement | null>(null);
  const sectionHeadings = Cell.source<DocsHeading[]>([]);

  let activePath = currentRoute.get().fullPath;
  activePath = activePath.split('?')[0];
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

  onConnected(articleRef, (articleNode) => {
    const collectHeadings = () => {
      const headingElements = articleNode.querySelectorAll('h2, h3');
      const headingIdCount = new Map<string, number>();
      const nextHeadings: DocsHeading[] = [];

      for (const headingElement of headingElements) {
        const headingLabel = headingElement.textContent?.trim();
        if (!headingLabel) {
          continue;
        }

        let headingId = headingLabel
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/gu, '')
          .trim()
          .replace(/\s+/gu, '-');
        if (headingId === '') {
          continue;
        }

        const seenCount = headingIdCount.get(headingId) ?? 0;
        headingIdCount.set(headingId, seenCount + 1);
        if (seenCount > 0) {
          headingId = `${headingId}-${seenCount}`;
        }

        headingElement.id = headingId;
        let depth = 2;
        if (headingElement.tagName === 'H3') {
          depth = 3;
        }

        nextHeadings.push({ id: headingId, label: headingLabel, depth });
      }

      sectionHeadings.set(nextHeadings);
    };

    collectHeadings();
    queueMicrotask(collectHeadings);
  });

  const components = createMDXComponents();

  return (
    <section class="grid grid-cols-1 gap-10 text-balance lg:grid-cols-[220px_minmax(0,1fr)_200px] lg:gap-10">
      <DocsSidebar />

      <article ref={articleRef} class="docs-markdown min-w-0">
        <ActivePage components={components} />
      </article>

      <DocsOnThisPage sectionHeadings={sectionHeadings} />
    </section>
  );
}
