import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Publishes the prebuilt platform packages. A bare run is a full release and
// requires every platform binary to be present, so the main package's
// `optionalDependencies` all resolve. Pass `--allow-missing` for an intentional
// partial release (for example macOS-only), or `--target=<os-arch>` to publish
// exactly one. Binaries are produced by `native:build` locally or downloaded
// from the Build Native Addon workflow's artifacts into native/npm/<target>/.
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const npmRoot = path.join(packageRoot, 'native', 'npm');
const dryRun = process.argv.includes('--dry-run');
const allowMissing = process.argv.includes('--allow-missing');
const requestedTarget = process.argv
  .find((arg) => arg.startsWith('--target='))
  ?.slice('--target='.length);

const allTargets = fs
  .readdirSync(npmRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .toSorted();

const selected = requestedTarget
  ? allTargets.filter((target) => target === requestedTarget)
  : allTargets;
if (selected.length === 0) {
  throw new Error(`No platform package directory for ${requestedTarget}.`);
}

const missing = selected.filter(
  (target) =>
    !fs.existsSync(
      path.join(npmRoot, target, `retend-gpui-native.${target}.node`)
    )
);
// An explicitly requested target is always strict; a bare run is strict unless
// the caller opts into a partial release.
if (missing.length > 0 && (requestedTarget || !allowMissing)) {
  throw new Error(
    `Missing prebuilt native binaries for ${missing.join(', ')}. Build them or download the CI artifacts into native/npm/<target>/ before publishing, or pass --allow-missing for a partial release.`
  );
}
const publishable = selected.filter((target) => !missing.includes(target));
if (publishable.length === 0) {
  throw new Error(
    'No platform binaries were found to publish. Run native:build first.'
  );
}
if (missing.length > 0) {
  console.warn(
    `Partial release: skipping ${missing.join(', ')}. Installs on those platforms will fail with a missing-binary error.`
  );
}

// The main package's `optionalDependencies` pin the platform packages to its
// own version, so a stale committed manifest would publish a mismatched
// release. Sync each published manifest to the current main version first.
const mainVersion = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
).version;
for (const target of publishable) {
  const manifestPath = path.join(npmRoot, target, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== mainVersion) {
    console.log(
      `Syncing ${target} version ${manifest.version} -> ${mainVersion}.`
    );
    manifest.version = mainVersion;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

for (const target of publishable) {
  const args = ['publish', '--access', 'public', '--no-git-checks'];
  if (dryRun) args.push('--dry-run');
  const result = spawnSync('pnpm', args, {
    cwd: path.join(npmRoot, target),
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Published ${publishable.length} platform package(s).`);
