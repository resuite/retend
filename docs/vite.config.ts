import { cloudflare } from '@cloudflare/vite-plugin';
import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import remarkGfm from 'remark-gfm';
import { retendSSG } from 'retend-server/plugin';
import { retend } from 'retend-web/plugins/vite';
import { defineConfig } from 'vite';

import { addHeadingIds, docsHeadingsByPath, docsPages } from './config/docs';

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
      ...mdx({
        include: /\.mdx$/u,
        jsxImportSource: 'retend',
        remarkPlugins: [remarkGfm, addHeadingIds],
      }),
    },
    retend(),
    retendSSG({
      inlineEnvironmentImports: true,
      pages: ['/', ...docsPages],
      routerModulePath: './source/router.tsx',
      rootSelector: '#root',
    }),
    cloudflare(),
  ],
});
