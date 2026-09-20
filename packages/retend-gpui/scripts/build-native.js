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

function runNapi(args, { retries = 0 } = {}) {
  const binary = path.join(
    packageRoot,
    'node_modules',
    '.bin',
    `napi${process.platform === 'win32' ? '.cmd' : ''}`
  );
  // Windows cannot spawn .cmd shims without a shell (Node ≥22 reports
  // EINVAL), so route through cmd.exe there. The binary path is absolute,
  // which keeps shell quoting unambiguous.
  for (let attempt = 0; ; attempt++) {
    const result = spawnSync(binary, args, {
      cwd: packageRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.error) console.error(result.error.message);
    if (result.status === 0) return;
    if (attempt >= retries) process.exit(result.status ?? 1);
    console.warn(
      `napi ${args[0]} failed (attempt ${attempt + 1} of ${retries + 1}), retrying...`
    );
    Atomics.wait(
      new Int32Array(new SharedArrayBuffer(4)),
      0,
      0,
      1000 * (attempt + 1)
    );
  }
}

// Regenerate the platform manifests so their versions track the main package
// even when this run only produces one binary. The manifest step commits via
// an atomic journal rename that can transiently collide with antivirus or
// indexing holds on Windows (EPERM), so retry it there.
runNapi(['create-npm-dirs', '--npm-dir', 'native/npm'], {
  retries: process.platform === 'win32' ? 4 : 0,
});

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
// The build commits via an atomic journal rename that can transiently
// collide with antivirus or indexing holds on Windows (EPERM), so retry it
// there. Retries are cheap: cargo is incremental and only re-runs the copy.
runNapi(napiArgs, { retries: process.platform === 'win32' ? 4 : 0 });

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
if (targetOs === 'win32' && process.platform === 'win32') {
  embedWindowsManifest(packageDestination);
}
console.log(`Built ${path.relative(packageRoot, packageDestination)}`);

// Declares a Common-Controls v6 dependency inside the built .node binary so
// the loader resolves comctl32 imports (e.g. TaskDialogIndirect) against the
// v6 side-by-side assembly. Plain node.exe carries no v6 activation context,
// so without this the addon fails to load with ERROR_PROC_NOT_FOUND on
// stock Windows. A missing mt.exe only warns: the binary still builds.
function embedWindowsManifest(binaryPath) {
  const mt = findWindowsMtExe();
  if (!mt) {
    console.warn(
      'mt.exe not found; skipping Common-Controls manifest embed. ' +
        'The native binary may fail to load on hosts without a v6 activation context.'
    );
    return;
  }
  const manifest = path.join(packageRoot, 'native', 'common-controls.manifest');
  const embedded = spawnSync(
    mt,
    ['-nologo', '-manifest', manifest, `-outputresource:${binaryPath};2`],
    { stdio: 'inherit' }
  );
  if (embedded.error) console.error(embedded.error.message);
  if (embedded.status !== 0) process.exit(embedded.status ?? 1);
}

function findWindowsMtExe() {
  try {
    const kitsBin = path.join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'Windows Kits',
      '10',
      'bin'
    );
    const versions = fs
      .readdirSync(kitsBin)
      .filter((entry) => /^\d+\.\d+/.test(entry))
      .toSorted()
      .toReversed();
    for (const version of versions) {
      const candidate = path.join(kitsBin, version, 'x64', 'mt.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Fall through to the warning in embedWindowsManifest.
  }
  return null;
}
