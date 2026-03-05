import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import { globSync } from 'node:fs';
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

const docsContentFiles = globSync('content/**/*.mdx', {
  cwd: __dirname,
}).toSorted();
for (const docsContentFile of docsContentFiles) {
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
