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
      pages: [
        '/',
        '/element-bounding',
        '/window-size',
        '/match-media',
        '/live-date',
        '/network-status',
        '/local-storage',
        '/session-storage',
        '/router-lock',
        '/input-test',
        '/fluid-list',
        '/cursor-position',
        '/page-1',
        '/page-2',
        '/use-setup-effect',
      ],
      inlineEnvironmentImports: true,
      routerModulePath: './source/router.ts',
    }),
  ],
});
