import type { JSX } from 'retend/jsx-runtime';

/// <reference types="vite/client" />

export type DocPage = {
  headings: { id: string; label: string; depth: number }[];
  href: string;
  slug: string;
  label: string;
  section: string;
  sectionLabel: string;
  isIndex: boolean;
  sortKey: string;
  Component: (props: { components: Record<string, unknown> }) => JSX.Element;
};

export type DocSectionData = {
  label: string;
  href: string;
  pages: DocPage[];
};

type DocModule = Record<string, { default: DocPage['Component'] }>;

const docModules = import.meta.glob('../../../content/**/*.mdx', {
  eager: true,
}) as DocModule;
declare const __DOC_HEADINGS__: Record<string, DocPage['headings']>;

export const docPages: DocPage[] = [];

for (const [filePath, mdxModule] of Object.entries(docModules)) {
  const relativePath = filePath
    .replace('../../../content/', '')
    .replace(/\.mdx$/u, '');

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

  const pageSlug =
    normalizedSegments[normalizedSegments.length - 1] || 'overview';

  let headings: DocPage['headings'] = [];
  const pageHeadings = __DOC_HEADINGS__[filePath];
  if (Array.isArray(pageHeadings)) {
    headings = pageHeadings;
  }

  const labelParts = pageSlug.replace(/-/gu, ' ').split(' ');
  for (const [index, labelPart] of labelParts.entries()) {
    if (labelPart === '') continue;
    labelParts[index] = `${labelPart[0].toUpperCase()}${labelPart.slice(1)}`;
  }
  const label = labelParts.join(' ');

  docPages.push({
    headings,
    href,
    slug: pageSlug,
    label,
    section: 'all',
    sectionLabel: 'Documentation',
    isIndex: false,
    sortKey: relativePath,
    Component: mdxModule.default,
  });
}

// Sort alphabetically by file name (which means numerical order 01-, 02- etc)
docPages.sort((left, right) => left.sortKey.localeCompare(right.sortKey));

const sections = new Map<string, DocSectionData>();

sections.set('all', {
  label: 'Documentation',
  href: '/docs',
  pages: docPages,
});

export const sectionEntries = Array.from(sections.entries());
