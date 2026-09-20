import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Verifies every prebuilt binary is present, then delegates versioning and
// publishing to the napi-rs CLI (`napi pre-publish`), which syncs each
// platform manifest to the main version, merges exact-version entries into
// `optionalDependencies`, and publishes every target. Releases are always
// complete: a missing binary fails the run instead of shipping broken
// installs, because npm provides no rollback. Single-platform testing goes
// through package previews, never the registry. Binaries are produced by
// `native:build` locally or downloaded from the Build Native Addon
// workflow's artifacts into native/npm/<platform>/.
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const npmRoot = path.join(packageRoot, 'native', 'npm');
const dryRun = process.argv.includes('--dry-run');

const allTargets = fs
  .readdirSync(npmRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .toSorted();

const missing = allTargets.filter(
  (target) =>
    !fs.existsSync(
      path.join(npmRoot, target, `retend-gpui-native.${target}.node`)
    )
);
if (missing.length > 0) {
  throw new Error(
    `Missing prebuilt native binaries for ${missing.join(', ')}. Build them or download the CI artifacts into native/npm/<platform>/ before publishing.`
  );
}

const napiBinary = path.join(
  packageRoot,
  'node_modules',
  '.bin',
  `napi${process.platform === 'win32' ? '.cmd' : ''}`
);
const args = ['pre-publish', '--npm-dir', 'native/npm', '--no-gh-release'];
if (dryRun) args.push('--dry-run');
const result = spawnSync(napiBinary, args, {
  cwd: packageRoot,
  stdio: 'inherit',
  // Windows cannot spawn .cmd shims without a shell (Node ≥22 reports
  // EINVAL), so route through cmd.exe there. The binary path is absolute,
  // which keeps shell quoting unambiguous.
  shell: process.platform === 'win32',
});
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);
