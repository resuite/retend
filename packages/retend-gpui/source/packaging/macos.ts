import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** macOS application bundle builder. */
export interface MacAppRequest {
  appName: string;
  identifier: string;
  version: string;
  /** Absolute path to the bundled production entry. */
  bundleEntry: string;
  /** Absolute path to the matching native addon. */
  addonPath: string;
  /** Directory the `.app` is written into. */
  outputDir: string;
  /** Official Node.js executable used as the SEA base. */
  nodeBinary: string;
  /** Optional icon source (`.icns`, `.png`, or `.svg`). */
  icon?: string;
  log: (message: string) => void;
}

interface IconVariant {
  name: string;
  size: number;
}

const ICON_VARIANTS: IconVariant[] = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 },
];

function run(command: string, args: string[], failure: string): void {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${failure} (${command} exited with ${result.status}).`);
  }
}

function executableName(appName: string): string {
  const sanitized = appName.replace(/[^A-Za-z0-9._-]/g, '');
  return sanitized || 'app';
}

function plistString(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function infoPlist(
  request: MacAppRequest,
  executable: string,
  iconFile?: string
): string {
  const iconEntry = iconFile
    ? `\n    <key>CFBundleIconFile</key>\n    <string>${plistString(iconFile)}</string>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>${plistString(request.appName)}</string>
    <key>CFBundleExecutable</key>
    <string>${plistString(executable)}</string>
    <key>CFBundleIdentifier</key>
    <string>${plistString(request.identifier)}</string>
    <key>CFBundleName</key>
    <string>${plistString(request.appName)}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${plistString(request.version)}</string>
    <key>CFBundleVersion</key>
    <string>${plistString(request.version)}</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>${iconEntry}
</dict>
</plist>
`;
}

/**
 * Renders an icon source to a PNG via Quick Look, then builds an `.icns`.
 * Best effort: callers skip the icon if this throws.
 */
function pngFromSource(source: string): string {
  const extension = path.extname(source).toLowerCase();
  if (extension === '.png') return source;

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'retend-gpui-icon-'));
  run(
    'qlmanage',
    ['-t', '-s', '1024', '-o', directory, source],
    `Failed to render the application icon ${source}`
  );
  const rendered = fs
    .readdirSync(directory)
    .find((name) => name.endsWith('.png'));
  if (!rendered) {
    throw new Error(`Quick Look produced no image for ${source}.`);
  }
  return path.join(directory, rendered);
}

function buildIcns(source: string, destination: string): void {
  const png = pngFromSource(source);
  const iconset = `${destination}.iconset`;
  fs.mkdirSync(iconset, { recursive: true });
  for (const variant of ICON_VARIANTS) {
    run(
      'sips',
      [
        '-z',
        String(variant.size),
        String(variant.size),
        png,
        '--out',
        path.join(iconset, variant.name),
      ],
      'Failed to resize the application icon'
    );
  }
  run(
    'iconutil',
    ['-c', 'icns', iconset, '-o', destination],
    'Failed to build the application icon'
  );
  fs.rmSync(iconset, { recursive: true, force: true });
}

/**
 * Assembles a macOS `.app` around a SEA executable: the injected runtime in
 * `Contents/MacOS`, the native addon and icon in `Contents/Resources`, and an
 * `Info.plist` generated from the application metadata.
 */
export function buildMacApp(request: MacAppRequest): string {
  if (!request.addonPath || !fs.existsSync(request.addonPath)) {
    throw new Error(
      `Retend GPUI is missing the native addon at ${request.addonPath}.`
    );
  }

  const executable = executableName(request.appName);
  const appDir = path.join(request.outputDir, `${request.appName}.app`);
  const contents = path.join(appDir, 'Contents');
  const macosDir = path.join(contents, 'MacOS');
  const resourcesDir = path.join(contents, 'Resources');
  const nativeDir = path.join(resourcesDir, 'native');

  fs.rmSync(appDir, { recursive: true, force: true });
  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(nativeDir, { recursive: true });

  const executablePath = path.join(macosDir, executable);
  const seaConfig = {
    main: request.bundleEntry,
    mainFormat: 'module',
    output: executablePath,
    disableExperimentalSEAWarning: true,
  };
  const configPath = path.join(
    os.tmpdir(),
    `retend-gpui-sea-${process.pid}.json`
  );
  fs.writeFileSync(configPath, JSON.stringify(seaConfig));
  try {
    run(
      request.nodeBinary,
      ['--build-sea', configPath],
      'Failed to build the single executable application'
    );
  } finally {
    fs.rmSync(configPath, { force: true });
  }

  fs.copyFileSync(
    request.addonPath,
    path.join(nativeDir, path.basename(request.addonPath))
  );

  let iconFile: string | undefined;
  if (request.icon && fs.existsSync(request.icon)) {
    try {
      const destination = path.join(resourcesDir, 'AppIcon.icns');
      if (path.extname(request.icon).toLowerCase() === '.icns') {
        fs.copyFileSync(request.icon, destination);
      } else {
        buildIcns(request.icon, destination);
      }
      iconFile = 'AppIcon';
    } catch (error) {
      request.log(
        `retend-gpui: skipped the application icon (${error instanceof Error ? error.message : String(error)}).`
      );
    }
  }

  fs.writeFileSync(
    path.join(contents, 'Info.plist'),
    infoPlist(request, executable, iconFile)
  );

  // The bundle is signed once, after every resource and Info.plist is in place;
  // signing the bare executable first would record a resource-less seal.
  if (process.platform === 'darwin') {
    run(
      'codesign',
      ['--force', '--sign', '-', appDir],
      'Failed to sign the application bundle'
    );
  }

  return appDir;
}

interface DmgRequest {
  appDir: string;
  outputDir: string;
  appName: string;
}

/** Wraps a finished `.app` in a compressed disk image. */
export function buildDmg(request: DmgRequest): string {
  const dmgPath = path.join(request.outputDir, `${request.appName}.dmg`);
  fs.rmSync(dmgPath, { force: true });
  run(
    'hdiutil',
    [
      'create',
      '-volname',
      request.appName,
      '-srcfolder',
      request.appDir,
      '-ov',
      '-format',
      'UDZO',
      dmgPath,
    ],
    'Failed to build the disk image'
  );
  return dmgPath;
}

/**
 * Writes the end-user install note next to the distribution artifacts. The app
 * is not signed with a paid Apple certificate, so the note explains the
 * Gatekeeper prompt instead of leaving users to guess.
 */
export function writeInstallNotes(outputDir: string, appName: string): string {
  const file = path.join(outputDir, 'INSTALL.txt');
  fs.writeFileSync(
    file,
    `${appName} - installation

1. Drag "${appName}.app" into /Applications (or ~/Applications).

   Run it from there, not from Downloads, Desktop, or Documents. macOS
   restricts apps that run from those folders and will ask for permission to
   use them.

2. The first time you open it, macOS may say it cannot verify the developer.
   That message means the app has no paid Apple Developer certificate, so
   Apple has no information about it. It does not mean malware was found.

   To allow it once:
     - Open System Settings > Privacy & Security, find the message about
       "${appName}", and click "Open Anyway";
     - or run this in Terminal:
         xattr -dr com.apple.quarantine "/Applications/${appName}.app"

3. Open the app. Later launches start normally.
`
  );
  return file;
}
