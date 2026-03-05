import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'retend-devtools-inject-css-entry',
      generateBundle(_options, bundle) {
        const entry = bundle['index.js'];
        if (entry) {
          if (entry.type === 'chunk') {
            entry.code = `import "./index.css";\n${entry.code}`;
          }
        }
      },
    },
  ],
  build: {
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'source/RetendDevTools.tsx'),
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['retend', 'retend/jsx-runtime', 'retend/router', 'retend-web'],
    },
    sourcemap: false,
  },
});
