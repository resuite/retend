import fs from 'node:fs';
import { execSync } from 'node:child_process';

if (fs.existsSync('dist')) {
  console.log('Removing dist directory...');
  fs.rmSync('dist', { recursive: true, force: true });
  console.log('Done!');
}

fs.mkdirSync('dist');

// Copy the library, router, render and helpers directories to the dist directory.
console.log('Copying directories to dist...');
for (const dir of fs.readdirSync('source')) {
  fs.cpSync(`source/${dir}`, `dist/${dir}`, { recursive: true });
}
console.log('Done!');

console.log('Building types...');
execSync('npx tsc --project tsconfig.json', { stdio: 'inherit' });
