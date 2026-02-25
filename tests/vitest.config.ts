import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    env: {
      // Retend generates marker nodes for HMR in dev mode, which
      // breaks serialization and shadow root tests.
      DEV: undefined,
    },
    browser: {
      provider: 'playwright',
      fileParallelism: true,
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      isolate: true,

    },
  },
});
