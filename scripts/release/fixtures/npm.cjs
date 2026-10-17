#!/usr/bin/env node
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const args = process.argv.slice(2);
const version = '0.0.37';
const already = new Set(
  fs.readFileSync(process.env.MOCK_STATE, 'utf8').split(',').filter(Boolean)
);
function log(record) {
  fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify(record) + '\n');
}
if (args[0] === 'view') {
  const name = args[1].split('@')[0];
  log({ action: 'view', name });
  if (already.has(name)) {
    process.stdout.write(JSON.stringify(version));
  } else {
    process.stderr.write('npm ERR! E404 missing\n');
    process.exitCode = 1;
  }
} else if (args[0] === 'publish') {
  const input = args[1];
  let pkg;
  if (input.endsWith('.tgz')) {
    const archive = spawnSync('tar', ['-xOf', input, 'package/package.json'], {
      encoding: 'utf8',
    });
    if (archive.status !== 0) throw new Error(archive.stderr);
    pkg = JSON.parse(archive.stdout);
  } else {
    pkg = JSON.parse(fs.readFileSync(path.join(input, 'package.json'), 'utf8'));
    const expected = path.join(input, pkg.main);
    if (!fs.statSync(expected).isFile())
      throw new Error('Native package missing binary: ' + expected);
  }
  log({
    action: 'publish',
    name: pkg.name,
    optionalDependencies: pkg.optionalDependencies,
    dryRun: args.includes('--dry-run'),
  });
  if (pkg.name === process.env.MOCK_FAIL_NAME) {
    process.stderr.write('Simulated npm failure: ' + pkg.name);
    process.exitCode = 77;
  } else if (!args.includes('--dry-run')) {
    already.add(pkg.name);
    fs.writeFileSync(process.env.MOCK_STATE, [...already].join(','));
  }
} else {
  throw new Error('Unexpected npm command: ' + args.join(' '));
}
