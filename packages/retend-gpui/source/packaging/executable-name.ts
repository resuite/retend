/** A stable executable basename for application bundles. */
export function executableName(
  appName: string,
  platform: 'darwin' | 'win32'
): string {
  const name = appName.replace(/[^A-Za-z0-9._-]/g, '');
  if (
    !name ||
    /^\.+$/.test(name) ||
    (platform === 'win32' &&
      (name.endsWith('.') ||
        /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)))
  ) {
    throw new Error(
      `Invalid ${platform} executable name from app.name: ${appName}`
    );
  }
  return name;
}
