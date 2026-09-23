import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { executableName } from './executable-name.js';

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
  /** Developer ID signing. Omitted, the bundle is signed ad-hoc. */
  signing?: MacSigningOptions;
  log: (message: string) => void;
}

/** Developer ID signing options. */
export interface MacSigningOptions {
  /** `codesign` identity, e.g. `Developer ID Application: Name (TEAMID)`. */
  identity: string;
  /** Custom entitlements plist; a JIT-capable default is generated otherwise. */
  entitlements?: string;
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

/** Builds the `.app`: executable, addon, icon, and Info.plist. */
export function buildMacApp(request: MacAppRequest): string {
  if (!request.addonPath || !fs.existsSync(request.addonPath)) {
    throw new Error(
      `Retend GPUI is missing the native addon at ${request.addonPath}.`
    );
  }

  const executable = executableName(request.appName, 'darwin');
  const appDir = path.join(request.outputDir, `${request.appName}.app`);
  const contents = path.join(appDir, 'Contents');
  const macosDir = path.join(contents, 'MacOS');
  const resourcesDir = path.join(contents, 'Resources');
  const nativeDir = path.join(resourcesDir, 'native');

  fs.rmSync(appDir, { recursive: true, force: true });
  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(nativeDir, { recursive: true });

  // Imported assets resolve under Contents/Resources/assets at runtime.
  const assetsSource = path.join(request.outputDir, 'assets');
  if (fs.existsSync(assetsSource)) {
    fs.cpSync(assetsSource, path.join(resourcesDir, 'assets'), {
      recursive: true,
    });
  }

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

  const addonDestination = path.join(
    nativeDir,
    path.basename(request.addonPath)
  );
  fs.copyFileSync(request.addonPath, addonDestination);

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

  // Sign innermost first: nested code, then the executable, then the bundle.
  if (request.signing) {
    const entitlements =
      request.signing.entitlements ?? writeDefaultEntitlements();
    sign(addonDestination, request.signing.identity, entitlements);
    sign(executablePath, request.signing.identity, entitlements);
    sign(appDir, request.signing.identity, entitlements);
    run(
      'codesign',
      ['--verify', '--deep', '--strict', '--verbose=2', appDir],
      'The signed application failed verification'
    );
    request.log(`retend-gpui: signed with ${request.signing.identity}`);
  } else if (process.platform === 'darwin') {
    run(
      'codesign',
      ['--force', '--sign', '-', appDir],
      'Failed to sign the application bundle'
    );
  }

  return appDir;
}

function sign(target: string, identity: string, entitlements: string): void {
  run(
    'codesign',
    [
      '--force',
      '--options',
      'runtime',
      '--timestamp',
      '--entitlements',
      entitlements,
      '--sign',
      identity,
      target,
    ],
    `Failed to sign ${path.basename(target)}`
  );
}

/** Hardened-runtime entitlements V8 needs: JIT and loading a separate addon. */
function writeDefaultEntitlements(): string {
  const file = path.join(
    os.tmpdir(),
    `retend-gpui-entitlements-${process.pid}.plist`
  );
  fs.writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
`
  );
  return file;
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
