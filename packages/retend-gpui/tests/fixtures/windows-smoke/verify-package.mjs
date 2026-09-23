import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';

const executable = fileURLToPath(
  new URL('./dist/win32-x64/GpuiSmoke.exe', import.meta.url)
);
const binary = fs.readFileSync(executable);
const peOffset = binary.readUInt32LE(0x3c);
assert.equal(binary.readUInt16LE(peOffset + 24 + 68), 2, 'GUI subsystem');

const entries = NtExecutableResource.from(
  NtExecutable.from(binary, { ignoreCert: true })
).entries;
const icon = Resource.IconGroupEntry.fromEntries(entries)[0];
assert.ok(icon, 'embedded application icon');
assert.deepEqual(
  icon.icons.map(({ width }) => width || 256),
  [16, 32, 48, 256]
);

const version = Resource.VersionInfo.fromEntries(entries)[0];
assert.ok(version, 'embedded version information');
assert.equal(
  version.getStringValues(version.getAllLanguagesForStringValues()[0])
    .ProductName,
  'GpuiSmoke'
);
