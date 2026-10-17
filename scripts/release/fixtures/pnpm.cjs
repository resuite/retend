#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
if (
  args[0] !== '--dir' ||
  args[2] !== 'pack' ||
  args[3] !== '--pack-destination'
) {
  throw new Error('Unexpected pnpm command: ' + args.join(' '));
}
const directory = args[1];
const output = args[4];
const pkg = JSON.parse(
  fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
);
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-mock-pack-'));
try {
  const packageDir = path.join(staging, 'package');
  fs.mkdirSync(packageDir);
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(pkg));
  const archive = path.join(output, pkg.name + '-' + pkg.version + '.tgz');
  const result = spawnSync('tar', ['-czf', archive, '-C', staging, 'package'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr);
  fs.appendFileSync(
    process.env.MOCK_LOG,
    JSON.stringify({ action: 'pack', name: pkg.name }) + '\n'
  );
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
