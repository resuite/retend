import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';

import { copyPublicDir } from '../source/packaging/macos.js';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-mac-test-'));
  temporaryRoots.push(root);
  return root;
}

it('copies public entries to the Resources root', () => {
  const root = temporaryRoot();
  const publicDir = path.join(root, 'public');
  const resourcesDir = path.join(root, 'Resources');
  fs.mkdirSync(path.join(publicDir, 'images'), { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), 'png');
  fs.writeFileSync(path.join(publicDir, 'images', 'hero.jpg'), 'jpg');

  copyPublicDir(publicDir, resourcesDir);

  expect(fs.readFileSync(path.join(resourcesDir, 'favicon.png'), 'utf8')).toBe(
    'png'
  );
  expect(
    fs.readFileSync(path.join(resourcesDir, 'images', 'hero.jpg'), 'utf8')
  ).toBe('jpg');
});

it('merges public entries with the imported assets directory', () => {
  const root = temporaryRoot();
  const publicDir = path.join(root, 'public');
  const resourcesDir = path.join(root, 'Resources');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(path.join(resourcesDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), 'png');
  fs.writeFileSync(path.join(resourcesDir, 'assets', 'icon-abc.svg'), 'svg');

  copyPublicDir(publicDir, resourcesDir);

  expect(fs.existsSync(path.join(resourcesDir, 'favicon.png'))).toBe(true);
  expect(fs.existsSync(path.join(resourcesDir, 'assets', 'icon-abc.svg'))).toBe(
    true
  );
});

it('does nothing when the public directory is missing', () => {
  const root = temporaryRoot();
  const resourcesDir = path.join(root, 'Resources');
  fs.mkdirSync(resourcesDir, { recursive: true });

  copyPublicDir(undefined, resourcesDir);
  copyPublicDir(path.join(root, 'no-public'), resourcesDir);

  expect(fs.readdirSync(resourcesDir)).toEqual([]);
});
