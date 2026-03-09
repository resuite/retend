import path from 'node:path';
import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'source'),
    },
  },
  plugins: [
    cssInjectedByJsPlugin({
      styleId: '__retend-web-devtools-styling',
      jsAssetsFilterFunction(chunk) {
        return chunk.fileName === 'index.js';
      },
    }),
  ],

  build: {
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: {
        index: path.resolve(__dirname, 'source/RetendDevTools.tsx'),
        prod: path.resolve(
          __dirname,
          'source/RetendDevToolsProductionEntry.tsx'
        ),
      },
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: ['retend', 'retend/jsx-runtime', 'retend/router', 'retend-web'],
    },
    sourcemap: false,
  },
});
