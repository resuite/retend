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

const docModules = import.meta.glob('../../../content/**/*.mdx', {
  eager: true,
}) as Record<
  string,
  {
    default: DocPage['Component'];
  }
>;
declare const __DOC_HEADINGS__: Record<string, DocPage['headings']>;

const labelOverrides = new Map<string, string>([
  ['ssr-and-ssg', 'SSR and SSG'],
  ['jsx-and-components', 'JSX and Components'],
  ['api-reference', 'API Reference'],
  ['seo-and-meta', 'SEO and Meta'],
  ['hmr', 'HMR'],
  ['on-connected', 'OnConnected'],
  ['on-setup', 'OnSetup'],
  ['under-the-hood', 'Core API'],
  ['getting-started', 'Getting Started'],
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

export const docPages: DocPage[] = [];

for (const [filePath, mdxModule] of Object.entries(docModules)) {
  const relativePath = filePath
    .replace('../../../content/', '')
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

  let headings: DocPage['headings'] = [];
  const pageHeadings = __DOC_HEADINGS__[filePath];
  if (Array.isArray(pageHeadings)) {
    headings = pageHeadings;
  }

  docPages.push({
    headings,
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

const sections = new Map<string, DocSectionData>();

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

export const sectionEntries = Array.from(sections.entries());
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
