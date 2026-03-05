import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { retendSSG } from 'retend-server/plugin';
import { retend } from 'retend-web/plugin';
import { defineConfig } from 'vite';

const docsPages = new Set<string>();
docsPages.add('/docs');
const collapsedSections = new Set([
  'built-in-utilities',
  'advanced-components',
  'ssr-and-ssg',
]);
const headingIdFromLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-');

const headingLabelFromMarkdown = (value: string) => {
  let result = value.replace(/\[[^\]]*\]\([^)]*\)/gu, (segment) => {
    const closingBracket = segment.indexOf(']');
    if (closingBracket < 1) return '';
    return segment.slice(1, closingBracket);
  });
  result = result.replace(/`([^`]+)`/gu, '$1');
  result = result.replace(/[*_~]/gu, '');
  result = result.replace(/<[^>]+>/gu, '');
  return result.trim();
};

const headingListFromMarkdown = (content: string) => {
  const headingIdCount = new Map<string, number>();
  const headings: Array<{ id: string; label: string; depth: number }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.startsWith('## ')) {
      if (!line.startsWith('### ')) {
        continue;
      }
    }
    let depth = 2;
    let rawLabel = line.slice(3);
    if (line.startsWith('### ')) {
      depth = 3;
      rawLabel = line.slice(4);
    }

    const label = headingLabelFromMarkdown(rawLabel);
    if (label === '') {
      continue;
    }

    let id = headingIdFromLabel(label);
    if (id === '') {
      continue;
    }

    const seenCount = headingIdCount.get(id) ?? 0;
    headingIdCount.set(id, seenCount + 1);
    if (seenCount > 0) {
      id = `${id}-${seenCount}`;
    }

    headings.push({ id, label, depth });
  }

  return headings;
};
const docsHeadingsByPath: Record<
  string,
  Array<{ id: string; label: string; depth: number }>
> = {};

const docsContentFiles = globSync('content/**/*.mdx', {
  cwd: __dirname,
}).toSorted();
for (const docsContentFile of docsContentFiles) {
  const source = readFileSync(path.resolve(__dirname, docsContentFile), 'utf8');
  docsHeadingsByPath[`../../../${docsContentFile}`] =
    headingListFromMarkdown(source);

  const segments = docsContentFile
    .replace(/^content\//u, '')
    .replace(/\.mdx$/u, '')
    .split('/');

  const normalizedSegments: string[] = [];
  for (const segment of segments) {
    if (segment === 'index') continue;
    normalizedSegments.push(segment.replace(/^\d+-/u, ''));
  }

  let page = '/docs';
  if (normalizedSegments.length > 0) {
    page = `${page}/${normalizedSegments.join('/')}`;
  }

  if (normalizedSegments.length > 1) {
    if (collapsedSections.has(normalizedSegments[0])) {
      continue;
    }
    if (normalizedSegments[0] === 'under-the-hood') {
      if (normalizedSegments[1] !== 'api-reference') {
        continue;
      }
    }
  }

  docsPages.add(page);
}

export default defineConfig({
  define: {
    __DOC_HEADINGS__: JSON.stringify(docsHeadingsByPath),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') },
  },
  plugins: [
    tailwindcss(),
    {
      enforce: 'pre',
      ...mdx({ include: /\.mdx$/u, jsxImportSource: 'retend' }),
    },
    retend(),
    retendSSG({
      inlineEnvironmentImports: true,
      pages: ['/', '/quickstart', ...docsPages],
      routerModulePath: './source/router.tsx',
      rootSelector: '#root',
    }),
  ],
});
