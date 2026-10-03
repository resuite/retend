import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface MacosDevelopmentExecutable {
  readonly path: string;
  readonly bundlePath: string;
  dispose(): void;
}

function plistString(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * Creates a minimal temporary macOS application bundle whose executable is a
 * symlink to the current Node runtime. AppKit still runs in the same process;
 * the bundle only gives LaunchServices the configured application identity for
 * Dock and Mission Control presentation during development.
 */
export function createMacosDevelopmentExecutable(
  appName: string,
  identifier: string,
  executable = process.execPath
): MacosDevelopmentExecutable {
  if (
    !appName ||
    appName.includes('\0') ||
    appName.includes('/') ||
    !identifier ||
    identifier.includes('\0')
  ) {
    throw new Error(
      'retend-gpui: invalid macOS development application identity.'
    );
  }

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'retend-gpui-dev-app-')
  );
  const bundlePath = path.join(directory, `${appName}.app`);
  const contents = path.join(bundlePath, 'Contents');
  const macos = path.join(contents, 'MacOS');
  const executablePath = path.join(macos, appName);

  try {
    fs.mkdirSync(macos, { recursive: true });
    fs.symlinkSync(executable, executablePath);
    fs.writeFileSync(
      path.join(contents, 'Info.plist'),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>${plistString(appName)}</string>
  <key>CFBundleExecutable</key>
  <string>${plistString(appName)}</string>
  <key>CFBundleIdentifier</key>
  <string>${plistString(identifier)}</string>
  <key>CFBundleName</key>
  <string>${plistString(appName)}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`
    );
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }

  let disposed = false;
  return {
    path: executablePath,
    bundlePath,
    dispose() {
      if (disposed) return;
      disposed = true;
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
