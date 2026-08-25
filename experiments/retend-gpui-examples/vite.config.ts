import { retendGpui } from 'retend-gpui/plugins/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  plugins: [
    retendGpui({
      app: {
        name: 'Retend GPUI',
        identifier: 'dev.retend.gpui.examples',
        version: '0.0.0',
        icon: './source/app-icon.svg',
      },
      application: './source/application.ts',
      entry: './source/main.tsx',
      window: {
        title: 'Retend GPUI',
        width: 1280,
        height: 840,
      },
    }),
  ],
});
