import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { retend } from 'retend-web/plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') },
  },
  plugins: [tailwindcss(), retend()],
});
