import path from 'node:path';
import { pathToFileURL } from 'node:url';

let assetBase: string | undefined;

/**
 * Sets the directory that root-relative asset URLs resolve against.
 *
 * Production bundles emit imported assets under `assets/` next to the entry
 * (or in the application bundle's resource directory), and Vite references them
 * as `/assets/<name>`. Development serves the same imports from the project
 * root, so the base is the Vite root there.
 *
 * @internal
 */
export function setAssetBase(directory: string | undefined): void {
  assetBase = directory;
}

/**
 * Resolves an author-provided image source to something the native renderer can
 * load. Root-relative sources (`/assets/icon.png`) are emitted by the build and
 * become `file:` URLs under the resource directory; remote, `data:`, and
 * `file:` sources pass through unchanged.
 */
export function resolveAssetSource(source: string): string {
  if (!source.startsWith('/') || !assetBase) return source;
  return pathToFileURL(path.join(assetBase, source)).href;
}
