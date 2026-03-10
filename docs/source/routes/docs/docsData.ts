/// <reference types="vite/client" />
import type { JSX } from 'retend/jsx-runtime';

export interface DocPage {
  headings: {
    id: string;
    selector: '' | `#${string}`;
    label: string;
    depth: number;
  }[];
  href: string;
  slug: string;
  label: string;
  section: string;
  sectionLabel: string;
  isIndex: boolean;
  sortKey: string;
  title: string;
  description: string;
  Component: (props: { components: Record<string, unknown> }) => JSX.Element;
}

export interface DocSectionData {
  label: string;
  href: string;
  pages: DocPage[];
}

type DocModule = Record<string, { default: DocPage['Component'] }>;

const modules = import.meta.glob('../../../content/**/*.mdx', { eager: true });
declare const __DOC_METADATA__: Record<
  string,
  { headings: DocPage['headings']; title: string; description: string }
>;

const normalizePathSegments = (relativePath: string): string[] =>
  relativePath
    .split('/')
    .filter((segment) => segment !== 'index')
    .map((segment) => segment.replace(/^\d+-/u, ''));

const createLabelFromSlug = (slug: string): string => {
  const labelMap: Record<string, string> = {
    'Shadow Root': 'ShadowRoot',
    Devtools: 'DevTools',
  };

  const label = slug
    .replace(/-/gu, ' ')
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');

  return labelMap[label] || label;
};

const createDocPage = ([filePath, mdxModule]: [
  string,
  { default: DocPage['Component'] },
]): DocPage => {
  const relativePath = filePath
    .replace('../../../content/', '')
    .replace(/\.mdx$/u, '');
  const segments = normalizePathSegments(relativePath);
  const slug = segments[segments.length - 1] || 'overview';
  const pageMeta = __DOC_METADATA__[filePath] || {
    headings: [],
    title: '',
    description: '',
  };

  return {
    headings: Array.isArray(pageMeta.headings) ? pageMeta.headings : [],
    title: pageMeta.title || '',
    description: pageMeta.description || '',
    href: segments.length > 0 ? `/docs/${segments.join('/')}` : '/docs',
    slug,
    label: createLabelFromSlug(slug),
    section: 'all',
    sectionLabel: 'Documentation',
    isIndex: false,
    sortKey: relativePath,
    Component: mdxModule.default,
  };
};

export const docPages: DocPage[] = Object.entries(modules as DocModule)
  .map(createDocPage)
  .toSorted((left, right) => left.sortKey.localeCompare(right.sortKey));

export const sectionEntries: [string, DocSectionData][] = [
  [
    'all',
    {
      label: 'Documentation',
      href: '/docs',
      pages: docPages,
    },
  ],
];
