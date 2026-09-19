// Best-effort Playwright browser install for the `retend-test-suite` workspace.
// Runs automatically via the root `postinstall` script so a plain
// `pnpm install` leaves `pnpm run test` ready to go.
//
// Design notes:
// - Idempotent: `playwright install chromium` skips already-downloaded builds.
// - Never fails the install: network / sandbox failures warn instead of
//   throwing, so offline or restricted installs still complete. Tests will
//   surface the clear Playwright "Executable doesn't exist" error instead.
// - Skips Android/Termux: Playwright hard-crashes with
//   "Unsupported platform: android" while resolving its browser cache dir, and
//   the suite already points at the system Chromium there
//   (see tests/vitest.config.ts). Honor PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD too.
import { execSync } from 'node:child_process';

if (process.platform === 'android') {
  console.log(
    '[postinstall] Skipping Playwright browser download on Android (uses system Chromium).'
  );
  process.exit(0);
}

if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD) {
  console.log(
    '[postinstall] PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set, skipping browser download.'
  );
  process.exit(0);
}

try {
  execSync('pnpm --filter retend-test-suite exec playwright install chromium', {
    stdio: 'inherit',
  });
} catch {
  console.warn(
    '[postinstall] Warning: Playwright chromium install failed. ' +
      'Run `pnpm --filter retend-test-suite exec playwright install chromium` manually before `pnpm run test`.'
  );
}
