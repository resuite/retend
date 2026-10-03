import { fileURLToPath } from 'node:url';
import { retendGpui } from 'retend-gpui/plugins/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    retendGpui({
      target: 'win32-x64',
      app: {
        name: 'GpuiSmoke',
        identifier: 'dev.retend.gpui.smoke',
        version: '1.0.0',
        icon: './icon.svg',
      },
      application: './application.ts',
      entry: './main.tsx',
      window: { width: 320, height: 240 },
    }),
  ],
});
