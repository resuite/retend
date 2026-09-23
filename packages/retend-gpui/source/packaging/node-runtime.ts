import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Embedded by default. ESM single-executable apps need Node 26 or later. */
export const DEFAULT_NODE_VERSION = '26.9.0';

interface NodeRuntimeRequest {
  version: string;
  target: string;
  cacheDir: string;
}

function nodeArchiveUrl(version: string, target: string): string {
  const os = target.split('-')[0];
  const extension = os === 'win32' ? 'zip' : 'tar.gz';
  const archiveTarget =
    os === 'win32' ? target.replace('win32-', 'win-') : target;
  return `https://nodejs.org/dist/v${version}/node-v${version}-${archiveTarget}.${extension}`;
}

function runtimeRoot(
  cacheDir: string,
  version: string,
  target: string
): string {
  return path.join(cacheDir, `node-v${version}-${target}`);
}

/**
 * Returns the path to the Node.js executable for `target`, downloading and
 * caching the official build from nodejs.org. Package-manager builds are not
 * usable as a base: the produced executable crashes on launch.
 */
export async function acquireNodeRuntime(
  request: NodeRuntimeRequest
): Promise<string> {
  const { version, target, cacheDir } = request;
  const [os, arch] = target.split('-');
  if (os !== process.platform || arch !== process.arch) {
    throw new Error(
      `Retend GPUI can package ${target} only on a matching ${target} host (current: ${process.platform}-${process.arch}).`
    );
  }
  const root = runtimeRoot(cacheDir, version, target);
  const executable = path.join(
    root,
    ...(target.startsWith('win32') ? ['node.exe'] : ['bin', 'node'])
  );
  if (fs.existsSync(executable)) return executable;

  const url = nodeArchiveUrl(version, target);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download the Node.js runtime from ${url}: HTTP ${response.status}.`
    );
  }
  const archive = new Uint8Array(await response.arrayBuffer());

  fs.mkdirSync(root, { recursive: true });
  const archivePath = path.join(root, `${path.basename(url)}`);
  fs.writeFileSync(archivePath, archive);

  const extracted = spawnSync(
    'tar',
    [
      os === 'win32' ? '-xf' : '-xzf',
      archivePath,
      '-C',
      root,
      '--strip-components=1',
    ],
    {
      stdio: 'inherit',
    }
  );
  if (extracted.status !== 0) {
    throw new Error(`Failed to extract the Node.js runtime at ${archivePath}.`);
  }
  fs.rmSync(archivePath, { force: true });

  if (!fs.existsSync(executable)) {
    throw new Error(
      `The Node.js runtime download did not contain ${path.relative(root, executable)}.`
    );
  }
  return executable;
}
