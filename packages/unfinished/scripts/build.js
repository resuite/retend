import fs from 'node:fs';
import { execSync } from 'node:child_process';

if (fs.existsSync('dist')) {
  console.log('Removing dist directory...');
  fs.rmSync('dist', { recursive: true, force: true });
  console.log('Done!');
}

fs.mkdirSync('dist');

// Copy the source directories to the dist directory.
console.log('Copying directories to dist...');
for (const dir of fs.readdirSync('source')) {
  fs.cpSync(`source/${dir}`, `dist/${dir}`, { recursive: true });
}
console.log('Done!');

console.log('Building types...');
execSync('npx tsc --emitDeclarationOnly --outDir dist', { stdio: 'inherit' });

// // For the jsx-runtime directory, we need to replace the .d.ts.map file with the actual .d.ts file.
// console.log('Fixing jsx-runtime types...');
// const jsxRuntimeDir = 'dist/jsx-runtime';

// const jsxRuntimeTargetDtsFile = `${jsxRuntimeDir}/index.d.ts`;
// const jsxRuntimeSourceDtsFile = 'source/jsx-runtime/index.d.ts';

// const jsxRuntimeDtsMapFile = `${jsxRuntimeDir}/index.d.ts.map`;
// const jsxRuntimeDtsContent = fs.readFileSync(jsxRuntimeSourceDtsFile, 'utf-8');

// fs.writeFileSync(jsxRuntimeTargetDtsFile, jsxRuntimeDtsContent);
// fs.unlinkSync(jsxRuntimeDtsMapFile);

console.log('Done!');
