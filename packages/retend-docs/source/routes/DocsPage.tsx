import type { JSX } from 'retend/jsx-runtime';

/// <reference types="vite/client" />
import { Cell, For, onConnected } from 'retend';
import { Link, useCurrentRoute } from 'retend/router';

import { createMDXComponents } from '@/components/MDXComponents';

type DocPage = {
  href: string;
  slug: string;
  label: string;
  section: string;
  sectionLabel: string;
  isIndex: boolean;
  sortKey: string;
  Component: (props: { components: Record<string, unknown> }) => JSX.Element;
};

const docModules = import.meta.glob('../../content/**/*.mdx', {
  eager: true,
}) as Record<string, { default: DocPage['Component'] }>;

const labelOverrides = new Map<string, string>([
  ['ssr-and-ssg', 'SSR and SSG'],
  ['jsx-and-components', 'JSX and Components'],
  ['api-reference', 'API Reference'],
  ['seo-and-meta', 'SEO and Meta'],
  ['hmr', 'HMR'],
  ['on-connected', 'OnConnected'],
  ['on-setup', 'OnSetup'],
  ['under-the-hood', 'Core API'],
]);

const sectionOrder = [
  'getting-started',
  'core-concepts',
  'state-and-lifecycle',
  'control-flow',
  'routing',
  'under-the-hood',
  'built-in-utilities',
  'advanced-components',
  'ssr-and-ssg',
];

const pageOrder = new Map<string, string[]>([
  ['getting-started', ['installation', 'quick-start', 'hello-world']],
  [
    'core-concepts',
    ['jsx-and-components', 'reactivity-cells', 'styling', 'event-handling'],
  ],
  ['state-and-lifecycle', ['on-setup', 'on-connected', 'context-and-scopes']],
  ['control-flow', ['if', 'for', 'switch', 'async-boundaries']],
  [
    'routing',
    [
      'defining-routes',
      'outlets',
      'navigation',
      'queries-and-params',
      'middleware',
      'events-and-locking',
    ],
  ],
  [
    'built-in-utilities',
    ['components', 'state-hooks', 'dom-hooks', 'environment-hooks'],
  ],
  [
    'advanced-components',
    ['unique-instances', 'teleport', 'shadow-root', 'flip-animations'],
  ],
  [
    'ssr-and-ssg',
    [
      'architecture',
      'render-to-string',
      'static-site-generation',
      'hydration',
      'client-only',
      'seo-and-meta',
    ],
  ],
  [
    'under-the-hood',
    ['global-context', 'renderer-interface', 'hmr', 'api-reference'],
  ],
]);

const stopWords = new Set([
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'a',
  'an',
  'the',
]);
const collapsedSections = new Set([
  'built-in-utilities',
  'advanced-components',
  'ssr-and-ssg',
]);

const docPages: DocPage[] = [];

for (const [filePath, mdxModule] of Object.entries(docModules)) {
  const relativePath = filePath
    .replace('../../content/', '')
    .replace(/\.mdx$/u, '');
  let isIndex = false;
  if (relativePath === 'index') {
    isIndex = true;
  }
  if (relativePath.endsWith('/index')) {
    isIndex = true;
  }
  const pathSegments = relativePath.split('/');
  const normalizedSegments: string[] = [];

  for (const pathSegment of pathSegments) {
    if (pathSegment === 'index') continue;
    normalizedSegments.push(pathSegment.replace(/^\d+-/u, ''));
  }

  let href = '/docs';
  if (normalizedSegments.length > 0) {
    href = `${href}/${normalizedSegments.join('/')}`;
  }

  let section = 'overview';
  if (normalizedSegments.length > 0) {
    section = normalizedSegments[0];
  }
  let pageSlug = section;
  if (normalizedSegments.length > 0) {
    pageSlug = normalizedSegments[normalizedSegments.length - 1];
  }

  if (normalizedSegments.length > 1) {
    if (collapsedSections.has(section)) {
      continue;
    }
    if (section === 'under-the-hood') {
      if (pageSlug !== 'api-reference') {
        continue;
      }
    }
  }

  const sectionParts = section.replace(/-/gu, ' ').split(' ');
  for (const [index, sectionPart] of sectionParts.entries()) {
    if (sectionPart === '') continue;
    const lowerWord = sectionPart.toLowerCase();
    let nextWord = `${lowerWord[0].toUpperCase()}${lowerWord.slice(1)}`;
    if (index > 0) {
      if (stopWords.has(lowerWord)) {
        nextWord = lowerWord;
      }
    }
    sectionParts[index] = nextWord;
  }
  let sectionLabel = sectionParts.join(' ');
  const sectionOverride = labelOverrides.get(section);
  if (sectionOverride) {
    sectionLabel = sectionOverride;
  }

  const labelSource = pageSlug;
  const labelParts = labelSource.replace(/-/gu, ' ').split(' ');
  for (const [index, labelPart] of labelParts.entries()) {
    if (labelPart === '') continue;
    const lowerWord = labelPart.toLowerCase();
    let nextWord = `${lowerWord[0].toUpperCase()}${lowerWord.slice(1)}`;
    if (index > 0) {
      if (stopWords.has(lowerWord)) {
        nextWord = lowerWord;
      }
    }
    labelParts[index] = nextWord;
  }
  let label = labelParts.join(' ');
  const labelOverride = labelOverrides.get(labelSource);
  if (labelOverride) {
    label = labelOverride;
  }

  docPages.push({
    href,
    slug: labelSource,
    label,
    section,
    sectionLabel,
    isIndex,
    sortKey: relativePath,
    Component: mdxModule.default,
  });
}

docPages.sort((left, right) => left.sortKey.localeCompare(right.sortKey));

const sections = new Map<
  string,
  { label: string; href: string; pages: DocPage[] }
>();

for (const docPage of docPages) {
  if (docPage.section === 'overview') {
    continue;
  }

  let sectionData = sections.get(docPage.section);
  if (!sectionData) {
    sectionData = {
      label: docPage.sectionLabel,
      href: `/docs/${docPage.section}`,
      pages: [],
    };
    sections.set(docPage.section, sectionData);
  }

  if (docPage.isIndex) {
    sectionData.href = docPage.href;
    continue;
  }

  if (collapsedSections.has(docPage.section)) {
    continue;
  }

  if (docPage.section === 'under-the-hood') {
    if (docPage.slug !== 'api-reference') {
      continue;
    }
  }

  sectionData.pages.push(docPage);
}

const sectionEntries = Array.from(sections.entries());
const sectionOrderIndex = new Map<string, number>();
for (const [index, sectionKey] of sectionOrder.entries()) {
  sectionOrderIndex.set(sectionKey, index);
}

for (const [sectionKey, sectionData] of sectionEntries) {
  const sectionPageOrder = pageOrder.get(sectionKey);
  sectionData.pages.sort((left, right) => {
    let leftOrder = Number.MAX_SAFE_INTEGER;
    let rightOrder = Number.MAX_SAFE_INTEGER;

    if (sectionPageOrder) {
      const leftIndex = sectionPageOrder.indexOf(left.slug);
      if (leftIndex > -1) {
        leftOrder = leftIndex;
      }

      const rightIndex = sectionPageOrder.indexOf(right.slug);
      if (rightIndex > -1) {
        rightOrder = rightIndex;
      }
    }

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.label.localeCompare(right.label);
  });
}

sectionEntries.sort((left, right) => {
  let leftOrder = Number.MAX_SAFE_INTEGER;
  let rightOrder = Number.MAX_SAFE_INTEGER;

  const leftIndex = sectionOrderIndex.get(left[0]);
  if (leftIndex !== undefined) {
    leftOrder = leftIndex;
  }

  const rightIndex = sectionOrderIndex.get(right[0]);
  if (rightIndex !== undefined) {
    rightOrder = rightIndex;
  }

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left[1].label.localeCompare(right[1].label);
});

export function DocsPage() {
  const currentRoute = useCurrentRoute();
  const articleRef = Cell.source<HTMLElement | null>(null);
  const sectionHeadings = Cell.source<
    { id: string; label: string; depth: number }[]
  >([]);

  let activePath = currentRoute.get().fullPath;
  activePath = activePath.split('?')[0];
  if (activePath.endsWith('/')) {
    activePath = activePath.slice(0, -1);
  }

  let activePage: DocPage | null = null;
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
      const nextHeadings: { id: string; label: string; depth: number }[] = [];

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
      <aside class="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
        <h1 class="text-fg text-xl tracking-tight">Documentation</h1>
        <nav class="flex flex-col gap-7" aria-label="Documentation pages">
          {For(sectionEntries, (entry) => {
            const sectionData = entry[1];

            return (
              <div class="flex flex-col gap-3">
                <Link
                  href={sectionData.href}
                  class="text-fg-muted hover:text-brand text-xs tracking-[0.08em] transition-colors"
                >
                  {sectionData.label}
                </Link>
                <div class="flex flex-col gap-2">
                  {For(
                    sectionData.pages,
                    (docPage) => (
                      <Link
                        href={docPage.href}
                        class="text-fg-muted hover:text-brand text-sm transition-colors"
                      >
                        {docPage.label}
                      </Link>
                    ),
                    { key: 'href' }
                  )}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      <article ref={articleRef} class="docs-markdown min-w-0">
        <ActivePage components={components} />
      </article>

      <aside class="docs-on-this-page hidden lg:sticky lg:top-8 lg:block lg:self-start">
        <h2 class="text-fg-muted text-xs tracking-[0.08em] uppercase">
          On This Page
        </h2>
        <nav class="mt-4 flex flex-col gap-2" aria-label="Page sections">
          {For(
            sectionHeadings,
            (heading) => {
              let itemClass =
                'text-fg-muted hover:text-brand text-sm transition-colors';
              if (heading.depth > 2) {
                itemClass =
                  'text-fg-muted hover:text-brand text-sm transition-colors pl-3';
              }

              return (
                <a href={`#${heading.id}`} class={itemClass}>
                  {heading.label}
                </a>
              );
            },
            { key: 'id' }
          )}
        </nav>
      </aside>
    </section>
  );
}
