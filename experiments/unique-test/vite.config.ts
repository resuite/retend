import path from 'node:path';
import { retendSSG } from 'retend-server/plugin';
import { retend } from 'retend-web/plugins/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') },
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    retend(),
    retendSSG({
      pages: ['/', '/parent'],
      inlineEnvironmentImports: true,
      routerModulePath: './source/router.ts',
    }),
  ],
});
