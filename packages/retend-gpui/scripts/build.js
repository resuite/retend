import { execSync } from 'node:child_process';
import fs from 'node:fs';

if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

fs.mkdirSync('dist');
// `source/` is TypeScript-only: `tsc` emits the whole `dist/` tree, including
// `dist/jsx-runtime/index.js`. Non-TS assets are not copied.
execSync('pnpm exec tsc --project tsconfig.build.json', { stdio: 'inherit' });
