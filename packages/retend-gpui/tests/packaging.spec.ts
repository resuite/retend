import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';

import { writeInstallNotes } from '../source/packaging/macos.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('writes an install note that explains the Gatekeeper prompt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-gpui-notes-'));
  roots.push(root);

  const file = writeInstallNotes(root, 'Demo App');
  const text = fs.readFileSync(file, 'utf8');

  expect(file).toBe(path.join(root, 'INSTALL.txt'));
  expect(text).toContain('Demo App.app');
  expect(text).toContain('xattr -dr com.apple.quarantine');
  expect(text).toContain('does not mean malware was found');
  expect(text).toContain('Open Anyway');
});
