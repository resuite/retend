import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const nativeRoot = path.join(packageRoot, 'native');
const targetKey = `${process.platform}-${process.arch}`;
if (!/^(darwin|linux|win32)-(arm64|x64)$/.test(targetKey)) {
  throw new Error(`Unsupported Retend GPUI native build target: ${targetKey}.`);
}
const release = process.argv.includes('--release');
const profile = release ? 'release' : 'debug';
const args = ['build', '--manifest-path', path.join(nativeRoot, 'Cargo.toml')];
if (release) args.push('--release');

const result = spawnSync('cargo', args, { cwd: packageRoot, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

const libraryName = {
  darwin: 'libretend_gpui_native.dylib',
  linux: 'libretend_gpui_native.so',
  win32: 'retend_gpui_native.dll',
}[process.platform];
const source = path.join(nativeRoot, 'target', profile, libraryName);
const targetName = `retend-gpui-native.${targetKey}.node`;
const packageDir = path.join(nativeRoot, 'npm', targetKey);
const packageDestination = path.join(packageDir, targetName);
fs.mkdirSync(packageDir, { recursive: true });
fs.copyFileSync(source, packageDestination);
if (process.platform === 'darwin') {
  const signed = spawnSync('codesign', [
    '--force',
    '--sign',
    '-',
    packageDestination,
  ]);
  if (signed.status !== 0) process.exit(signed.status ?? 1);
}
const manifest = {
  name: `@retend-gpui/native-${targetKey}`,
  version: '0.0.0',
  private: true,
  os: [process.platform],
  cpu: [process.arch],
  main: targetName,
  files: [targetName],
};
fs.writeFileSync(
  path.join(packageDir, 'package.json'),
  JSON.stringify(manifest)
);
console.log(`Built ${path.relative(packageRoot, packageDestination)}`);
