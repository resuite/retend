import { defineConfig } from 'vite';
import path from 'node:path';
import { retend } from 'retend/web/plugin';
import { retendSSG } from 'retend-server/plugin';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') }
  },
  plugins: [
    retend(),
    retendSSG({
      pages: ['/'],
      routerModulePath: './source/router.ts'
    }),
   ],
 });
