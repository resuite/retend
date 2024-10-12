// @ts-nocheck

/// <reference path="node" />

import fs from 'node:fs';
import { execSync } from 'node:child_process';

if (fs.existsSync('types')) {
  console.log('Removing types directory...');
  fs.rmSync('types', { recursive: true, force: true });
  console.log('Done!');
}

console.log('Building types...');
execSync('npx tsc --project jsconfig.json', { stdio: 'inherit' });
