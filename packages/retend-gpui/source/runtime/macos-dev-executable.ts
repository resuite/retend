import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface MacosDevelopmentExecutable {
  readonly path: string;
  dispose(): void;
}

/**
 * Creates a temporary executable symlink whose basename is the configured app
 * name. LaunchServices uses that basename as the display name for an unbundled
 * AppKit process, so development windows appear under `app.name` instead of
 * the underlying Node executable name.
 */
export function createMacosDevelopmentExecutable(
  appName: string,
  executable = process.execPath
): MacosDevelopmentExecutable {
  if (
    !appName ||
    appName === '.' ||
    appName === '..' ||
    appName.includes('/') ||
    appName.includes('\0')
  ) {
    throw new Error(
      `retend-gpui: app.name cannot be used as a macOS development application name: ${JSON.stringify(appName)}`
    );
  }

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'retend-gpui-dev-exec-')
  );
  const symlink = path.join(directory, appName);
  try {
    fs.symlinkSync(executable, symlink);
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }

  let disposed = false;
  return {
    path: symlink,
    dispose() {
      if (disposed) return;
      disposed = true;
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
