import { defineConfig } from 'vitest/config';

// On Android/Termux, Playwright hard-crashes with "Unsupported platform: android"
// while resolving its browser cache directory. Setting PLAYWRIGHT_BROWSERS_PATH
// bypasses that lookup; we then point Playwright at the system Chromium binary
// (installed via `pkg install x11-repo chromium`) instead of a downloaded one.
if (process.platform === 'android') {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
}

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
      // Vitest 3 ignores top-level `providerOptions` when `instances` is set
      // (each instance's own fields become the provider options), so the
      // Android-only launch options must live on the instance itself.
      instances: [
        {
          browser: 'chromium',
          ...(process.platform === 'android' && {
            launch: {
              // Termux Chromium from the TUR/X11 repo; requires --no-sandbox.
              executablePath:
                '/data/data/com.termux/files/usr/bin/chromium-browser',
              args: [
                '--no-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
              ],
            },
          }),
        },
      ],
      isolate: true,
    },
  },
});
