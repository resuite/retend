import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'source'),
    },
  },
  plugins: [
    {
      name: 'retend-devtools-inject-css-entry',
      generateBundle(_options, bundle) {
        const entry = bundle['index.js'];
        if (entry) {
          if (entry.type === 'chunk') {
            entry.code = `import "./retend-web-devtools.css";\n${entry.code}`;
          }
        }
      },
    },
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
