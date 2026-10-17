import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
export const packageNames = [
  'retend',
  'retend-web',
  'retend-web-devtools',
  'retend-server',
  'retend-utils',
  'retend-oxlint-plugin',
  'retend-gpui',
  'retend-start',
];
export const nativeTargets = [
  'darwin-arm64',
  'linux-arm64-gnu',
  'linux-x64-gnu',
  'win32-arm64-msvc',
  'win32-x64-msvc',
];
export const manifestPaths = [
  'package.json',
  ...packageNames.map((name) => `packages/${name}/package.json`),
  ...nativeTargets.map(
    (target) => `packages/retend-gpui/native/npm/${target}/package.json`
  ),
];

const semver = /^(\d+)\.(\d+)\.(\d+)$/;

export function nextPatch(version) {
  const match = semver.exec(version);
  if (!match)
    throw new Error(`Expected a stable semver version, got ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export function readVersion(directory = root) {
  return JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
    .version;
}

export function updateVersions(directory = root, nextVersion) {
  const current = readVersion(directory);
  if (!semver.test(nextVersion) || nextVersion === current) {
    throw new Error(`Invalid next version: ${nextVersion}`);
  }
  // Verify the entire lockstep set before writing any of it.
  const updates = manifestPaths.map((relative) => {
    const absolute = path.join(directory, relative);
    const source = readFileSync(absolute, 'utf8');
    const manifest = JSON.parse(source);
    if (manifest.version !== current) {
      throw new Error(
        `${relative} is at ${manifest.version}, expected ${current}`
      );
    }
    // Native optionalDependencies are added to the packed GPUI manifest
    // after the five platform packages have been built, not to the source
    // workspace: frozen installs must not require unpublished native versions.
    const output = source.replace(
      /("version"\s*:\s*")([^"]+)(")/,
      (_, start, _version, end) => `${start}${nextVersion}${end}`
    );
    if (output === source) throw new Error(`Missing version in ${relative}`);
    return { absolute, output };
  });
  for (const { absolute, output } of updates) writeFileSync(absolute, output);
  return nextVersion;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const command = process.argv[2];
  if (command === 'current') {
    console.log(readVersion());
  } else if (command === 'bump') {
    console.log(updateVersions(root, nextPatch(readVersion())));
  } else {
    console.error('Usage: node scripts/release/version.mjs current|bump');
    process.exitCode = 1;
  }
}
