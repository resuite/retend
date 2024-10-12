// @ts-nocheck

/// <reference path="node" />

import fs from 'node:fs';
import { execSync } from 'node:child_process';

if (fs.existsSync('types')) {
  console.log('Removing types directory...');
  fs.rmSync('types', { recursive: true, force: true });
  console.log('Done!');
}
fs.writeFileSync(
  'index.js',
  fs
    .readFileSync('index.js', 'utf8')
    .replace('', '')
    .replace('/// <reference path="./types/index.d.ts" />\n', ''),
);

console.log('Building types...');
execSync('npx tsc --project jsconfig.json', { stdio: 'inherit' });
fs.writeFileSync(
  'index.js',
  `
/// <reference path="./types/index.d.ts" />
${fs.readFileSync('index.js', 'utf8').trimStart()}`,
);
