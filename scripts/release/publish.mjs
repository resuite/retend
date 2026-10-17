import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { nativeTargets, packageNames, readVersion, root } from './version.mjs';

const dryRun = process.argv.includes('--dry-run');
if (
  !dryRun &&
  (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_URL)
) {
  throw new Error(
    'Publishing requires the trusted GitHub Actions release job.'
  );
}

const version = readVersion();
const gpuiDir = path.join(root, 'packages/retend-gpui');
const gpuiManifest = path.join(gpuiDir, 'package.json');

function run(binary, args, cwd = root) {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${binary} ${args.join(' ')} failed:\n${result.error?.message ?? result.stderr ?? result.stdout}`
    );
  }
  return result.stdout.trim();
}

function isPublished(name) {
  const result = spawnSync(
    'npm',
    ['view', `${name}@${version}`, 'version', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );
  if (result.status === 0) return JSON.parse(result.stdout) === version;
  if (/\bE404\b/.test(result.stderr)) return false;
  throw new Error(
    `npm registry lookup failed for ${name}@${version}: ${result.stderr}`
  );
}

function checkVersions() {
  // The artifact-collection step already checked native manifests.
  for (const relative of [
    'package.json',
    ...packageNames.map((name) => `packages/${name}/package.json`),
  ]) {
    const json = JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
    if (json.version !== version) {
      throw new Error(
        `${relative} has version ${json.version}, expected ${version}`
      );
    }
  }
}

function packWorkspace(name, directory) {
  const output = path.join(directory, name);
  mkdirSync(output);
  run('pnpm', [
    '--dir',
    path.join(root, 'packages', name),
    'pack',
    '--pack-destination',
    output,
  ]);
  const files = readdirSync(output);
  if (files.length !== 1 || !files[0].endsWith('.tgz')) {
    throw new Error(`Expected one tarball for ${name}, got ${files}`);
  }
  const tarball = path.join(output, files[0]);
  const packed = JSON.parse(
    run('tar', ['-xOf', tarball, 'package/package.json'])
  );
  if (packed.name !== name || packed.version !== version) {
    throw new Error(`Packed package mismatch: ${name}@${version}`);
  }
  for (const group of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    if (
      Object.values(packed[group] ?? {}).some((value) =>
        String(value).startsWith('workspace:')
      )
    ) {
      throw new Error(`Unresolved workspace: dependency in ${name}:${group}`);
    }
  }
  if (name === 'retend-gpui') {
    for (const target of nativeTargets) {
      const nativeName = `retend-gpui-native-${target}`;
      if (packed.optionalDependencies?.[nativeName] !== version) {
        throw new Error(
          `Missing exact native optional dependency: ${nativeName}@${version}`
        );
      }
    }
  }
  return tarball;
}

function publish(name, packagePath) {
  if (isPublished(name)) {
    console.log(`Already published ${name}@${version}; skipping`);
    return;
  }
  console.log(`${dryRun ? 'Checking' : 'Publishing'} ${name}@${version}`);
  const args = [
    'publish',
    packagePath,
    '--access',
    'public',
    '--ignore-scripts',
  ];
  if (dryRun) args.push('--dry-run');
  run('npm', args);
}

checkVersions();
const temporary = mkdtempSync(path.join(os.tmpdir(), 'retend-release-'));
const originalGpuiManifest = readFileSync(gpuiManifest, 'utf8');
try {
  // The source workspace has no native optional dependencies, so pnpm can
  // install before the new binaries exist. Add them only for packaging.
  const manifest = JSON.parse(originalGpuiManifest);
  manifest.optionalDependencies = Object.fromEntries(
    nativeTargets.map((target) => [`retend-gpui-native-${target}`, version])
  );
  writeFileSync(gpuiManifest, JSON.stringify(manifest, null, 2) + '\n');

  // Prepare and validate every archive before publishing anything.
  const archives = new Map(
    packageNames.map((name) => [name, packWorkspace(name, temporary)])
  );

  // All versions are declared in one package list. The only ordering rule:
  // publish the platform packages before the GPUI package that references them.
  for (const name of packageNames.filter((name) => name !== 'retend-gpui')) {
    publish(name, archives.get(name));
  }
  for (const target of nativeTargets) {
    const name = `retend-gpui-native-${target}`;
    publish(name, path.join(gpuiDir, 'native/npm', target));
  }
  publish('retend-gpui', archives.get('retend-gpui'));

  if (!dryRun) {
    for (const name of [
      ...packageNames,
      ...nativeTargets.map((target) => `retend-gpui-native-${target}`),
    ]) {
      if (!isPublished(name))
        throw new Error(`Missing published package: ${name}@${version}`);
    }
  }
} finally {
  writeFileSync(gpuiManifest, originalGpuiManifest);
  rmSync(temporary, { recursive: true, force: true });
}
