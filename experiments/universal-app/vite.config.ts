import { defineConfig } from 'vite';
import path from 'node:path';
import { retend } from 'retend-web/plugin';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') }
  },
  plugins: [
    retend(),
    
   ],
 });