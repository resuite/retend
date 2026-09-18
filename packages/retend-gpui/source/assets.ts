import path from 'node:path';
import { pathToFileURL } from 'node:url';

let assetBase: string | undefined;

/**
 * Sets the directory root-relative asset URLs resolve against: the resource
 * directory in a packaged app, the Vite root in development.
 *
 * @internal
 */
export function setAssetBase(directory: string | undefined): void {
  assetBase = directory;
}

/**
 * Resolves a root-relative asset source (`/assets/icon.png`) to a `file:` URL.
 * Remote, `data:`, and `file:` sources pass through unchanged.
 */
export function resolveAssetSource(source: string): string {
  if (!source.startsWith('/') || !assetBase) return source;
  return pathToFileURL(path.join(assetBase, source)).href;
}
