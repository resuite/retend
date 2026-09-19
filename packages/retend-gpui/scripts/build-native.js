import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const npmRoot = path.join(packageRoot, 'native', 'npm');
const release = process.argv.includes('--release');

const rustTriples = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-arm64-gnu': 'aarch64-unknown-linux-gnu',
  'linux-x64-gnu': 'x86_64-unknown-linux-gnu',
  'win32-arm64-msvc': 'aarch64-pc-windows-msvc',
  'win32-x64-msvc': 'x86_64-pc-windows-msvc',
};
const targets = Object.keys(rustTriples);

function hostTarget() {
  switch (process.platform) {
    case 'darwin':
      return `darwin-${process.arch}`;
    case 'linux':
      return `linux-${process.arch}-gnu`;
    case 'win32':
      return `win32-${process.arch}-msvc`;
    default:
      throw new Error(
        `Unsupported Retend GPUI native build host: ${process.platform}-${process.arch}.`
      );
  }
}

const host = hostTarget();
if (!targets.includes(host)) {
  throw new Error(`Unsupported Retend GPUI native build target: ${host}.`);
}

const requestedTarget = process.argv
  .find((arg) => arg.startsWith('--target='))
  ?.slice('--target='.length);
const buildTarget = requestedTarget || host;
if (!targets.includes(buildTarget)) {
  throw new Error(`Unsupported Retend GPUI native target: ${buildTarget}.`);
}
const targetOs = buildTarget.split('-')[0];
const crossCompiling = buildTarget !== host;
if (crossCompiling && targetOs !== process.platform) {
  throw new Error(
    `Retend GPUI cannot cross-build ${buildTarget} from ${host}. Run this target on a ${targetOs} runner.`
  );
}

function runNapi(args) {
  const binary = path.join(
    packageRoot,
    'node_modules',
    '.bin',
    `napi${process.platform === 'win32' ? '.cmd' : ''}`
  );
  const result = spawnSync(binary, args, {
    cwd: packageRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Regenerate the platform manifests so their versions track the main package
// even when this run only produces one binary.
runNapi(['create-npm-dirs', '--npm-dir', 'native/npm']);

const napiArgs = [
  'build',
  '--platform',
  '--target',
  rustTriples[buildTarget],
  '--manifest-path',
  'native/Cargo.toml',
  '--output-dir',
  path.join('native', 'npm', buildTarget),
  '--no-js',
];
if (release) napiArgs.push('--release');
// Release CI passes `--locked` so the published binaries come from the
// committed Cargo.lock rather than a freshly resolved graph.
if (process.argv.includes('--locked')) napiArgs.push('--', '--locked');
runNapi(napiArgs);

const outputDir = path.join(npmRoot, buildTarget);
for (const generated of fs.readdirSync(outputDir)) {
  if (generated.endsWith('.js') || generated.endsWith('.d.ts')) {
    fs.rmSync(path.join(outputDir, generated));
  }
}

const targetName = `retend-gpui-native.${buildTarget}.node`;
const packageDestination = path.join(npmRoot, buildTarget, targetName);
if (targetOs === 'darwin' && process.platform === 'darwin') {
  const signed = spawnSync('codesign', [
    '--force',
    '--sign',
    '-',
    packageDestination,
  ]);
  if (signed.status !== 0) process.exit(signed.status ?? 1);
}
console.log(`Built ${path.relative(packageRoot, packageDestination)}`);
