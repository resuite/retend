import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    browser: {
      provider: 'playwright',
      fileParallelism: false,
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      isolate: true,

    },
  },
});
