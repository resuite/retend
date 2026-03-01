import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { retendSSG } from 'retend-server/plugin';
import { retend } from 'retend-web/plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') },
  },
  plugins: [
    tailwindcss(),
    retend(),
    retendSSG({
      inlineEnvironmentImports: true,
      pages: ['/', '/features', '/quickstart'],
      routerModulePath: './source/router.ts',
      rootSelector: '#root',
    }),
  ],
});
