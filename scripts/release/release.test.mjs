import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { collectNativeArtifacts } from './collect-native.mjs';
import {
  manifestPaths,
  nativeTargets,
  nextPatch,
  readVersion,
  root,
  updateVersions,
} from './version.mjs';

function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'retend-release-test-'));
  for (const relative of manifestPaths) {
    const filename = path.join(directory, relative);
    mkdirSync(path.dirname(filename), { recursive: true });
    const name = relative.includes('/native/npm/')
      ? `retend-gpui-native-${relative.split('/')[4]}`
      : relative === 'package.json'
        ? 'retend-root'
        : relative.split('/')[1];
    writeFileSync(
      filename,
      JSON.stringify({ name, version: '0.0.36' }, null, 2) + '\n'
    );
  }
  return directory;
}

test('increments the current stable patch version', () => {
  assert.equal(nextPatch('0.0.36'), '0.0.37');
  assert.equal(nextPatch('1.9.99'), '1.9.100');
  assert.throws(() => nextPatch('0.0.36-beta.1'), /stable semver/);
});

test('bumps all workspace and platform manifests in lockstep', () => {
  const directory = fixture();
  try {
    assert.equal(updateVersions(directory, '0.0.37'), '0.0.37');
    for (const relative of manifestPaths) {
      const json = JSON.parse(readFileSync(path.join(directory, relative)));
      assert.equal(json.version, '0.0.37', relative);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects version drift before writing any manifests', () => {
  const directory = fixture();
  try {
    const bad = path.join(directory, manifestPaths.at(-1));
    writeFileSync(bad, '{"version":"0.0.35"}');
    assert.throws(() => updateVersions(directory, '0.0.37'), /expected 0.0.36/);
    assert.equal(
      JSON.parse(readFileSync(path.join(directory, 'package.json'))).version,
      '0.0.36'
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('pnpm pack produces npm-installable metadata rather than workspace protocols', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'retend-pack-test-'));
  try {
    const pack = spawnSync(
      'pnpm',
      [
        '--dir',
        path.join(root, 'packages/retend-server'),
        'pack',
        '--pack-destination',
        directory,
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(pack.status, 0, pack.stderr);
    const tarballs = readdirSync(directory).filter((name) =>
      name.endsWith('.tgz')
    );
    assert.equal(tarballs.length, 1);
    const archive = spawnSync(
      'tar',
      ['-xOf', path.join(directory, tarballs[0]), 'package/package.json'],
      {
        encoding: 'utf8',
      }
    );
    assert.equal(archive.status, 0, archive.stderr);
    const metadata = JSON.parse(archive.stdout);
    assert.equal(metadata.name, 'retend-server');
    assert.equal(metadata.version, readVersion());
    assert.equal(metadata.devDependencies.retend, readVersion());
    assert.equal(metadata.devDependencies['retend-web'], readVersion());
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('native targets agree across build script, napi config, matrix, and manifests', () => {
  const script = readFileSync(
    path.join(root, 'packages/retend-gpui/scripts/build-native.js'),
    'utf8'
  );
  const mappings = script.match(/const rustTriples = \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(mappings, 'native build script must declare rustTriples');
  const entries = [...mappings.matchAll(/'([^']+)': '([^']+)'/g)];
  const rustTargets = entries.map(([, , triple]) => triple).toSorted();
  const matrix = readFileSync(
    path.join(root, '.github/workflows/build-native.yml'),
    'utf8'
  );
  const matrixTargets = [...matrix.matchAll(/^\s+- target: (.+)$/gm)]
    .map((match) => match[1])
    .toSorted();
  const napi = JSON.parse(
    readFileSync(path.join(root, 'packages/retend-gpui/package.json'), 'utf8')
  );
  const manifestTargets = readdirSync(
    path.join(root, 'packages/retend-gpui/native/npm'),
    { withFileTypes: true }
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
  assert.deepEqual(
    entries.map(([, target]) => target).toSorted(),
    nativeTargets.toSorted()
  );
  assert.deepEqual(matrixTargets, nativeTargets.toSorted());
  assert.deepEqual(manifestTargets, nativeTargets.toSorted());
  assert.deepEqual(rustTargets, napi.napi.targets.toSorted());
});

test('collects exactly five named native artifacts before modifying destinations', () => {
  const directory = fixture();
  const artifacts = path.join(directory, 'artifacts');
  try {
    for (const target of nativeTargets) {
      const dir = path.join(artifacts, `retend-gpui-native-${target}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, `retend-gpui-native.${target}.node`),
        Buffer.alloc(2048)
      );
    }
    const copied = path.join(
      directory,
      'packages/retend-gpui/native/npm/darwin-arm64/retend-gpui-native.darwin-arm64.node'
    );
    rmSync(path.join(artifacts, 'retend-gpui-native-linux-x64-gnu'), {
      recursive: true,
    });
    assert.throws(
      () => collectNativeArtifacts(artifacts, directory),
      /Unexpected artifact set/
    );
    assert.equal(
      existsSync(copied),
      false,
      'failure must not leave partial copies'
    );

    const target = 'linux-x64-gnu';
    const nativeDir = path.join(artifacts, `retend-gpui-native-${target}`);
    mkdirSync(nativeDir);
    writeFileSync(
      path.join(nativeDir, `retend-gpui-native.${target}.node`),
      Buffer.from([1])
    );
    assert.doesNotThrow(() => collectNativeArtifacts(artifacts, directory));
    assert.equal(readFileSync(copied).length, 2048);
    const unexpected = path.join(artifacts, 'unexpected');
    mkdirSync(unexpected);
    assert.throws(
      () => collectNativeArtifacts(artifacts, directory),
      /Unexpected artifact set/
    );
    assert.equal(readFileSync(copied).length, 2048);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
