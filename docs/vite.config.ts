import { cloudflare } from '@cloudflare/vite-plugin';
import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import remarkGfm from 'remark-gfm';
import { retendSSG } from 'retend-server/plugin';
import { retend } from 'retend-web/plugins/vite';
import { defineConfig } from 'vite';

import { addHeadingIds, docsMetadataByPath, docsPages } from './config/docs';

export default defineConfig({
  build: {
    sourcemap: true,
  },
  define: {
    __DOC_METADATA__: JSON.stringify(docsMetadataByPath),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') },
  },
  plugins: [
    tailwindcss(),
    {
      name: 'strip-mdx-frontmatter',
      enforce: 'pre',
      transform(source, id) {
        if (!id.endsWith('.mdx')) {
          return null;
        }

        return source.replace(/^---\n[\s\S]*?\n---\n*/u, '');
      },
    },
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
