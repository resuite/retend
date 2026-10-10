import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createDocsFiles } from '../source/generators/shared.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

async function assertDirectoryMatch(source, copied) {
  const entries = await readdir(source, { withFileTypes: true });
  assert.deepEqual(
    (await readdir(copied)).toSorted(),
    entries.map((entry) => entry.name).toSorted()
  );
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(copied, entry.name);
    if (entry.isDirectory()) await assertDirectoryMatch(from, to);
    else assert.deepEqual(await readFile(to), await readFile(from));
  }
}

async function assertDocsMatchTemplate(root, template) {
  const source = path.join(packageRoot, template);
  assert.deepEqual(
    await readFile(path.join(root, 'AGENT.md')),
    await readFile(path.join(source, 'AGENT.md'))
  );
  await assertDirectoryMatch(
    path.join(source, '.docs'),
    path.join(root, '.docs')
  );
}

test('GPUI scaffolds copy the GPUI AI documentation bundle', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'retend-gpui-docs-'));
  try {
    await createDocsFiles(root, true, 'gpui');
    await assertDocsMatchTemplate(root, 'docs-gpui');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('web scaffolds continue to copy the web documentation bundle', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'retend-web-docs-'));
  try {
    await createDocsFiles(root, true, 'web');
    await assertDocsMatchTemplate(root, 'docs');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('invalid documentation targets fail instead of silently using web docs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'retend-invalid-docs-'));
  try {
    await assert.rejects(
      createDocsFiles(root, true, 'invalid'),
      /Unknown documentation target/
    );
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('documentation copy failures reject scaffolding instead of succeeding silently', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'retend-docs-error-'));
  try {
    const blocked = path.join(root, 'blocked');
    await writeFile(blocked, 'not a directory');
    await assert.rejects(createDocsFiles(blocked, true, 'gpui'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('AI docs are omitted unless requested', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'retend-no-docs-'));
  try {
    await createDocsFiles(root, false, 'gpui');
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
