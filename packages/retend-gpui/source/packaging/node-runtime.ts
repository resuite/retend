import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Node release that supports ESM SEA via `--build-sea`. */
export const DEFAULT_NODE_VERSION = '26.9.0';

interface NodeRuntimeRequest {
  version: string;
  target: string;
  cacheDir: string;
}

function nodeArchiveUrl(version: string, target: string): string {
  const os = target.split('-')[0];
  const extension = os === 'win32' ? 'zip' : 'tar.gz';
  return `https://nodejs.org/dist/v${version}/node-v${version}-${target}.${extension}`;
}

function runtimeRoot(
  cacheDir: string,
  version: string,
  target: string
): string {
  return path.join(cacheDir, `node-v${version}-${target}`);
}

/**
 * Ensures the official Node.js runtime for `target` is available locally and
 * returns the path to its executable. The runtime is downloaded from
 * nodejs.org and cached; the SEA base must be the official build because the
 * Homebrew/package-manager binaries are not injection-safe.
 */
export async function acquireNodeRuntime(
  request: NodeRuntimeRequest
): Promise<string> {
  const { version, target, cacheDir } = request;
  const root = runtimeRoot(cacheDir, version, target);
  const executable = path.join(
    root,
    'bin',
    target.startsWith('win32') ? 'node.exe' : 'node'
  );
  if (fs.existsSync(executable)) return executable;

  const os = target.split('-')[0];
  if (os === 'win32') {
    throw new Error(
      `Packaging a Windows application bundle is not implemented yet (${target}).`
    );
  }
  if (os !== process.platform) {
    throw new Error(
      `Retend GPUI cannot package ${target} from ${process.platform}; run the build on a ${os} host.`
    );
  }

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
    ['-xzf', archivePath, '-C', root, '--strip-components=1'],
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
