import { execSync } from 'node:child_process';
import fs from 'node:fs';

if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

fs.mkdirSync('dist');

for (const entry of fs.readdirSync('source')) {
  fs.cpSync(`source/${entry}`, `dist/${entry}`, {
    recursive: true,
    filter(source) {
      if (source.endsWith('.d.ts')) return true;
      return !source.endsWith('.ts');
    },
  });
}

fs.writeFileSync('dist/jsx-runtime/index.js', 'export {};\n');
execSync('pnpm exec tsc --project tsconfig.build.json', { stdio: 'inherit' });
