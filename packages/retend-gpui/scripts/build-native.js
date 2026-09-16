import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const nativeRoot = path.join(packageRoot, 'native');
const npmRoot = path.join(nativeRoot, 'npm');
const release = process.argv.includes('--release');
const profile = release ? 'release' : 'debug';

// Every supported OS/architecture is a workspace package so the main package can
// reference them from `optionalDependencies` while the lockfile stays stable.
const targets = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'win32-arm64',
  'win32-x64',
];
const rustTriples = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'win32-x64': 'x86_64-pc-windows-msvc',
};
const libraryNames = {
  darwin: 'libretend_gpui_native.dylib',
  linux: 'libretend_gpui_native.so',
  win32: 'retend_gpui_native.dll',
};

const hostTarget = `${process.platform}-${process.arch}`;
if (!targets.includes(hostTarget)) {
  throw new Error(
    `Unsupported Retend GPUI native build target: ${hostTarget}.`
  );
}

// The CI matrix builds one target per job. A target that matches the host is a
// native build; a same-OS target (for example darwin-x64 on an arm64 macOS
// runner) is a Rust cross-build. Cross-OS builds are rejected because they
// need the target platform's linker and SDK.
const requestedTarget = process.argv
  .find((arg) => arg.startsWith('--target='))
  ?.slice('--target='.length);
const buildTarget = requestedTarget || hostTarget;
if (!targets.includes(buildTarget)) {
  throw new Error(`Unsupported Retend GPUI native target: ${buildTarget}.`);
}
const targetOs = buildTarget.split('-')[0];
const crossCompiling = buildTarget !== hostTarget;
if (crossCompiling && targetOs !== process.platform) {
  throw new Error(
    `Retend GPUI cannot cross-build ${buildTarget} from ${hostTarget}. Run this target on a ${targetOs} runner.`
  );
}

const rootManifest = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
);

function packageManifestFor(target) {
  const [os, arch] = target.split('-');
  const binaryName = `retend-gpui-native.${target}.node`;
  return {
    name: `retend-gpui-native-${target}`,
    version: rootManifest.version,
    description: `Prebuilt Retend GPUI native addon for ${target}.`,
    license: rootManifest.license,
    repository: rootManifest.repository,
    os: [os],
    cpu: [arch],
    main: binaryName,
    files: [binaryName],
    publishConfig: { access: 'public' },
  };
}

// Rewrite all platform manifests so their versions track the main package even
// when this run only produces one binary.
for (const target of targets) {
  const packageDir = path.join(npmRoot, target);
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify(packageManifestFor(target), null, 2)}\n`
  );
}

const cargoArgs = [
  'build',
  '--manifest-path',
  path.join(nativeRoot, 'Cargo.toml'),
];
if (crossCompiling) cargoArgs.push('--target', rustTriples[buildTarget]);
if (release) cargoArgs.push('--release');
// Release CI passes `--locked` so the published binaries come from the
// committed Cargo.lock rather than a freshly resolved graph.
if (process.argv.includes('--locked')) cargoArgs.push('--locked');

const result = spawnSync('cargo', cargoArgs, {
  cwd: packageRoot,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);

const outputDir = crossCompiling
  ? path.join(nativeRoot, 'target', rustTriples[buildTarget], profile)
  : path.join(nativeRoot, 'target', profile);
const source = path.join(outputDir, libraryNames[targetOs]);
const targetName = `retend-gpui-native.${buildTarget}.node`;
const packageDir = path.join(npmRoot, buildTarget);
const packageDestination = path.join(packageDir, targetName);
fs.copyFileSync(source, packageDestination);
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
