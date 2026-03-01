import path from 'node:path';
import { retend } from 'retend-web/plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') },
  },
  plugins: [retend()],
});
