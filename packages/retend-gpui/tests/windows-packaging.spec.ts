import type { ResolvedConfig } from 'vite';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';
import sharp from 'sharp';
import { afterEach, expect, it, vi } from 'vitest';

import { executableName } from '../source/packaging/executable-name.js';
import {
  acquireNodeRuntime,
  DEFAULT_NODE_VERSION,
} from '../source/packaging/node-runtime.js';
import { buildWindowsApp } from '../source/packaging/windows.js';
import { retendGpui } from '../source/plugins/vite.js';

const temporaryRoots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-win-test-'));
  temporaryRoots.push(root);
  return root;
}

async function asWindowsX64<T>(run: () => Promise<T>): Promise<T> {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const arch = Object.getOwnPropertyDescriptor(process, 'arch')!;
  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
  Object.defineProperty(process, 'arch', { ...arch, value: 'x64' });
  try {
    return await run();
  } finally {
    Object.defineProperty(process, 'platform', platform);
    Object.defineProperty(process, 'arch', arch);
  }
}

function fakeNode(root: string, location: string): string {
  const fixture = path.join(root, 'base.exe');
  fs.writeFileSync(fixture, Buffer.from(NtExecutable.createEmpty().generate()));
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(
    location,
    `#!${process.execPath}\nconst fs = require('node:fs');\nconst config = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));\nfs.copyFileSync(${JSON.stringify(fixture)}, config.output);\n`
  );
  fs.chmodSync(location, 0o755);
  return location;
}

function resources(executable: string) {
  const exe = NtExecutable.from(fs.readFileSync(executable));
  return NtExecutableResource.from(exe).entries;
}

it('uses the official Windows archive and rejects a mismatched host architecture', async () => {
  const root = temporaryRoot();
  const archive = Buffer.from(
    'UEsDBBQAAAAAAI+CN11dm7CPAgAAAAIAAAAdAAAAbm9kZS12MjYuOS4wLXdpbi14NjQvbm9kZS5leGVNWlBLAQIUAxQAAAAAAI+CN11dm7CPAgAAAAIAAAAdAAAAAAAAAAAAAACAAQAAAABub2RlLXYyNi45LjAtd2luLXg2NC9ub2RlLmV4ZVBLBQYAAAAAAQABAEsAAAA9AAAAAAA=',
    'base64'
  );
  const fetchRuntime = vi.fn(async () => new Response(archive));
  vi.stubGlobal('fetch', fetchRuntime);
  await asWindowsX64(async () => {
    await expect(
      acquireNodeRuntime({
        version: '26.9.0',
        target: 'win32-arm64',
        cacheDir: root,
      })
    ).rejects.toThrow('matching win32-arm64 host');
    const executable = await acquireNodeRuntime({
      version: '26.9.0',
      target: 'win32-x64',
      cacheDir: root,
    });
    expect(fs.readFileSync(executable, 'utf8')).toBe('MZ');
  });
  expect(fetchRuntime).toHaveBeenCalledExactlyOnceWith(
    'https://nodejs.org/dist/v26.9.0/node-v26.9.0-win-x64.zip'
  );
});

it('rejects unusable Windows executable names', () => {
  expect(() => executableName('CON', 'win32')).toThrow(
    'Invalid win32 executable name'
  );
  expect(() => executableName('NUL.txt', 'win32')).toThrow(
    'Invalid win32 executable name'
  );
  expect(() => executableName('!!!', 'win32')).toThrow(
    'Invalid win32 executable name'
  );
});

it('writes real PE icon and version resources with the GUI subsystem', async () => {
  const root = temporaryRoot();
  const entry = path.join(root, 'index.js');
  const icon = path.join(root, 'icon.svg');
  fs.writeFileSync(entry, 'console.log("app")');
  fs.writeFileSync(
    icon,
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="red"/></svg>'
  );
  const executable = await buildWindowsApp({
    appName: 'My App',
    version: '1.2.3-beta.1',
    publisher: 'Example Co',
    bundleEntry: entry,
    outputDir: root,
    nodeBinary: fakeNode(root, path.join(root, 'node.exe')),
    icon,
  });

  expect(executable).toBe(path.join(root, 'MyApp.exe'));
  const binary = fs.readFileSync(executable);
  const peOffset = binary.readUInt32LE(0x3c);
  expect(binary.readUInt16LE(peOffset + 24 + 68)).toBe(2);
  const entries = resources(executable);
  const group = Resource.IconGroupEntry.fromEntries(entries)[0];
  expect(group.icons.map(({ width }) => width || 256)).toEqual([
    16, 32, 48, 256,
  ]);
  const small = group.getIconItemsFromEntries(entries)[0];
  expect(small.isRaw()).toBe(true);
  if (small.isRaw()) {
    const pixels = await sharp(Buffer.from(small.bin))
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(pixels[3]).toBe(0);
    expect(pixels[(4 * 16 + 0) * 4 + 3]).toBe(255);
  }
  const version = Resource.VersionInfo.fromEntries(entries)[0];
  expect(
    version.getStringValues(version.getAllLanguagesForStringValues()[0])
  ).toMatchObject({
    ProductName: 'My App',
    CompanyName: 'Example Co',
  });
});

it('packages the Vite Windows bundle with the native addon', async () => {
  const root = temporaryRoot();
  const output = path.join(root, 'dist', 'win32-x64');
  const icon = path.join(root, 'icon.svg');
  const node = path.join(
    root,
    `node_modules/.cache/retend-gpui/node-v${DEFAULT_NODE_VERSION}-win32-x64/node.exe`
  );
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    icon,
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>'
  );
  fs.writeFileSync(path.join(output, 'index.js'), 'console.log("app")');
  fakeNode(root, node);
  const plugin = retendGpui({
    app: {
      name: 'My App',
      identifier: 'dev.retend.test',
      version: '1.2.3',
      icon: './icon.svg',
    },
    application: './source/application.ts',
    entry: './source/main.ts',
    window: { width: 800, height: 600 },
    target: 'win32-x64',
  });
  Reflect.apply(plugin.config as Function, plugin, [
    { root },
    { command: 'build' },
  ]);
  (plugin.configResolved as (config: ResolvedConfig) => void)({
    root,
    command: 'build',
  } as ResolvedConfig);
  await asWindowsX64(async () => {
    await Reflect.apply(plugin.writeBundle as Function, { info: vi.fn() }, [
      { dir: output },
      {},
    ]);
  });

  expect(fs.existsSync(path.join(output, 'MyApp.exe'))).toBe(true);
  expect(fs.existsSync(path.join(output, 'AppIcon.svg'))).toBe(true);
  expect(
    fs.existsSync(
      path.join(output, 'native/retend-gpui-native.win32-x64-msvc.node')
    )
  ).toBe(true);
});
