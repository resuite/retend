import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit';
import sharp from 'sharp';

import { executableName } from './executable-name.js';

export interface WindowsAppRequest {
  appName: string;
  version: string;
  publisher?: string;
  description?: string;
  bundleEntry: string;
  outputDir: string;
  nodeBinary: string;
  icon?: string;
}

/** Builds a multi-resolution ICO from the same source used by the window icon. */
async function iconBytes(source: string): Promise<Buffer> {
  if (path.extname(source).toLowerCase() === '.ico') {
    return fs.readFileSync(source);
  }

  const sizes = [16, 32, 48, 256];
  const images = await Promise.all(
    sizes.map((size) =>
      sharp(source)
        .resize(size, size, { fit: 'contain', background: '#00000000' })
        .png()
        .toBuffer()
    )
  );
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  for (const [index, image] of images.entries()) {
    const entry = 6 + index * 16;
    header.writeUInt8(sizes[index] === 256 ? 0 : sizes[index], entry);
    header.writeUInt8(sizes[index] === 256 ? 0 : sizes[index], entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  }
  return Buffer.concat([header, ...images]);
}

async function editResources(
  executable: string,
  request: WindowsAppRequest
): Promise<void> {
  const exe = NtExecutable.from(fs.readFileSync(executable), {
    ignoreCert: true,
  });
  const resources = NtExecutableResource.from(exe);
  if (request.icon) {
    const icon = Data.IconFile.from(await iconBytes(request.icon));
    const group = Resource.IconGroupEntry.fromEntries(resources.entries)[0];
    Resource.IconGroupEntry.replaceIconsForResource(
      resources.entries,
      group?.id ?? 1,
      group?.lang ?? 1033,
      icon.icons.map((entry) => entry.data)
    );
  }

  const info =
    Resource.VersionInfo.fromEntries(resources.entries)[0] ??
    Resource.VersionInfo.create(1033, {}, []);
  const version = request.version.split(/[+-]/, 1)[0];
  info.setFileVersion(version);
  info.setProductVersion(version);
  info.setStringValues(
    info.getAllLanguagesForStringValues()[0] ?? { lang: 1033, codepage: 1200 },
    {
      ProductName: request.appName,
      FileDescription: request.description ?? request.appName,
      ...(request.publisher ? { CompanyName: request.publisher } : {}),
      OriginalFilename: path.basename(executable),
    }
  );
  info.outputToResourceEntries(resources.entries);
  resources.outputResource(exe);
  fs.writeFileSync(executable, Buffer.from(exe.generate()));
}

/** Mark the packaged Node executable as a GUI application so it opens no console. */
function useGuiSubsystem(executable: string): void {
  const file = fs.openSync(executable, 'r+');
  try {
    const header = Buffer.alloc(64);
    if (
      fs.readSync(file, header, 0, header.length, 0) !== header.length ||
      header.toString('ascii', 0, 2) !== 'MZ'
    ) {
      throw new Error('The Windows runtime is not a PE executable.');
    }
    const peOffset = header.readUInt32LE(0x3c);
    const peHeader = Buffer.alloc(94);
    if (
      fs.readSync(file, peHeader, 0, peHeader.length, peOffset) !==
        peHeader.length ||
      peHeader.toString('ascii', 0, 4) !== 'PE\0\0'
    ) {
      throw new Error('The Windows runtime has an invalid PE header.');
    }
    const optionalHeader = 24;
    if (peHeader.readUInt16LE(optionalHeader) !== 0x20b) {
      throw new Error('The Windows runtime is not a 64-bit PE executable.');
    }
    const subsystemOffset = peOffset + optionalHeader + 68;
    const guiSubsystem = Buffer.from([2, 0]);
    fs.writeSync(file, guiSubsystem, 0, guiSubsystem.length, subsystemOffset);
  } finally {
    fs.closeSync(file);
  }
}

/** Builds the Windows SEA beside its native addon, assets, and icon source. */
export async function buildWindowsApp(
  request: WindowsAppRequest
): Promise<string> {
  const executable = path.join(
    request.outputDir,
    `${executableName(request.appName, 'win32')}.exe`
  );
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-gpui-sea-'));
  const configPath = path.join(configDir, 'sea.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      main: request.bundleEntry,
      mainFormat: 'module',
      output: executable,
      disableExperimentalSEAWarning: true,
    })
  );
  try {
    const result = spawnSync(request.nodeBinary, ['--build-sea', configPath], {
      stdio: 'inherit',
    });
    if (result.error || result.status !== 0) {
      throw new Error(
        `Failed to build the Windows executable: ${result.error?.message ?? `Node exited with ${result.status}`}.`
      );
    }
  } finally {
    fs.rmSync(configDir, { recursive: true, force: true });
  }

  await editResources(executable, request);
  useGuiSubsystem(executable);
  return executable;
}
