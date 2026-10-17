import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { nativeTargets, packageNames } from './version.mjs';

const releaseScripts = path.dirname(fileURLToPath(import.meta.url));

function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'retend-publish-test-'));
  const scripts = path.join(dir, 'scripts/release');
  const binaries = path.join(dir, 'fake-bin');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(binaries);
  for (const filename of ['publish.mjs', 'version.mjs']) {
    copyFileSync(
      path.join(releaseScripts, filename),
      path.join(scripts, filename)
    );
  }
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ version: '0.0.37' })
  );
  for (const name of packageNames) {
    const folder = path.join(dir, 'packages', name);
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      path.join(folder, 'package.json'),
      JSON.stringify({ name, version: '0.0.37' })
    );
  }
  for (const target of nativeTargets) {
    const folder = path.join(dir, 'packages/retend-gpui/native/npm', target);
    mkdirSync(folder, { recursive: true });
    const main = 'retend-gpui-native.' + target + '.node';
    writeFileSync(
      path.join(folder, 'package.json'),
      JSON.stringify({
        name: 'retend-gpui-native-' + target,
        version: '0.0.37',
        main,
        files: [main],
      })
    );
    writeFileSync(path.join(folder, main), 'dummy native package payload');
  }
  const npm = path.join(binaries, 'npm');
  const pnpm = path.join(binaries, 'pnpm');
  copyFileSync(path.join(releaseScripts, 'fixtures/npm.cjs'), npm);
  copyFileSync(path.join(releaseScripts, 'fixtures/pnpm.cjs'), pnpm);
  chmodSync(npm, 0o755);
  chmodSync(pnpm, 0o755);
  return dir;
}

function execute(directory, { dryRun = false, published = [], failure } = {}) {
  const log = path.join(directory, 'calls.jsonl');
  const registry = path.join(directory, 'registry.txt');
  writeFileSync(log, '');
  writeFileSync(registry, published.join(','));
  const result = spawnSync(
    process.execPath,
    ['scripts/release/publish.mjs', ...(dryRun ? ['--dry-run'] : [])],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH:
          path.join(directory, 'fake-bin') + path.delimiter + process.env.PATH,
        MOCK_LOG: log,
        MOCK_STATE: registry,
        MOCK_FAIL_NAME: failure ?? '',
        GITHUB_ACTIONS: 'true',
        GITHUB_REF: 'refs/heads/main',
        ACTIONS_ID_TOKEN_REQUEST_URL: 'mock-oidc-url',
      },
    }
  );
  const calls = readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { result, calls };
}

function withFixture(fn) {
  const directory = fixture();
  try {
    fn(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('prepares every archive; native addons publish before GPUI with exact versions', () =>
  withFixture((directory) => {
    const { result, calls } = execute(directory);
    assert.equal(result.status, 0, result.stderr);
    const packs = calls.filter((call) => call.action === 'pack');
    const published = calls.filter((call) => call.action === 'publish');
    assert.deepEqual(
      packs.map((call) => call.name).toSorted(),
      packageNames.toSorted()
    );
    assert.equal(published.length, packageNames.length + nativeTargets.length);
    assert.ok(
      calls.indexOf(packs.at(-1)) < calls.indexOf(published[0]),
      'all workspaces packed before publishing'
    );
    const gpui = published.find((call) => call.name === 'retend-gpui');
    assert.deepEqual(
      gpui.optionalDependencies,
      Object.fromEntries(
        nativeTargets.map((target) => [
          'retend-gpui-native-' + target,
          '0.0.37',
        ])
      )
    );
    const gpuiIndex = published.indexOf(gpui);
    for (const target of nativeTargets) {
      assert.ok(
        published.findIndex(
          (call) => call.name === 'retend-gpui-native-' + target
        ) < gpuiIndex
      );
    }
    assert.equal(
      JSON.parse(
        readFileSync(path.join(directory, 'packages/retend-gpui/package.json'))
      ).optionalDependencies,
      undefined
    );
  }));

test('dry-run uses same packaging and optional dependencies but does not publish', () =>
  withFixture((directory) => {
    const { result, calls } = execute(directory, { dryRun: true });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      calls.filter((call) => call.action === 'pack').length,
      packageNames.length
    );
    const publishes = calls.filter((call) => call.action === 'publish');
    assert.equal(publishes.length, packageNames.length + nativeTargets.length);
    assert.ok(publishes.every((call) => call.dryRun));
  }));

test('partial release resumes without republishing registered versions', () =>
  withFixture((directory) => {
    const already = ['retend', 'retend-web', 'retend-gpui-native-darwin-arm64'];
    const { result, calls } = execute(directory, { published: already });
    assert.equal(result.status, 0, result.stderr);
    const published = calls
      .filter((call) => call.action === 'publish')
      .map((call) => call.name);
    for (const name of already) assert.ok(!published.includes(name), name);
    assert.equal(
      published.length,
      packageNames.length + nativeTargets.length - already.length
    );
  }));

test('npm failure stops publication and preserves source manifest for retry', () =>
  withFixture((directory) => {
    const failure = 'retend-gpui-native-linux-arm64-gnu';
    const { result, calls } = execute(directory, { failure });
    assert.notEqual(result.status, 0, 'npm publication failure must propagate');
    assert.match(result.stderr, /Simulated npm failure/);
    const published = calls
      .filter((call) => call.action === 'publish')
      .map((call) => call.name);
    assert.ok(published.includes(failure));
    assert.ok(
      !published.includes('retend-gpui'),
      'main GPUI must not publish after a native failure'
    );
    assert.equal(
      JSON.parse(
        readFileSync(path.join(directory, 'packages/retend-gpui/package.json'))
      ).optionalDependencies,
      undefined
    );
    const resumed = execute(directory, {
      published: published.filter((name) => name !== failure),
    });
    assert.equal(resumed.result.status, 0, resumed.result.stderr);
    assert.ok(
      resumed.calls.some(
        (call) => call.action === 'publish' && call.name === failure
      )
    );
    assert.ok(
      !resumed.calls.some(
        (call) => call.action === 'publish' && call.name === 'retend'
      )
    );
  }));
