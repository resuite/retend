import { defineConfig } from 'vite';
import path from 'node:path';
import { retend } from 'retend/web/plugin';
import { retendSSG } from 'retend-server/plugin';

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
      routerModulePath: './source/router.ts',
    }),
  ],
});
