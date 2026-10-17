import { copyFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nativeTargets, readVersion, root } from './version.mjs';

export function collectNativeArtifacts(artifactRoot, destinationRoot = root) {
  const uploaded = readdirSync(artifactRoot).toSorted();
  const expected = nativeTargets
    .map((target) => `retend-gpui-native-${target}`)
    .toSorted();
  if (JSON.stringify(uploaded) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected artifact set: ${uploaded.join(', ')}`);
  }

  const version = readVersion(destinationRoot);
  // Check the entire set before touching any destination file.
  const artifacts = nativeTargets.map((target) => {
    const name = `retend-gpui-native.${target}.node`;
    const sourceDir = path.join(artifactRoot, `retend-gpui-native-${target}`);
    const entries = readdirSync(sourceDir);
    if (entries.length !== 1 || entries[0] !== name) {
      throw new Error(
        `Unexpected addon files for ${target}: ${entries.join(', ')}`
      );
    }
    const source = path.join(sourceDir, name);
    if (!statSync(source).isFile())
      throw new Error(`Missing native addon: ${source}`);
    const destinationDir = path.join(
      destinationRoot,
      'packages/retend-gpui/native/npm',
      target
    );
    const manifest = JSON.parse(
      readFileSync(path.join(destinationDir, 'package.json'), 'utf8')
    );
    if (
      manifest.name !== `retend-gpui-native-${target}` ||
      manifest.version !== version
    ) {
      throw new Error(`Native manifest mismatch for ${target}@${version}`);
    }
    return { source, destination: path.join(destinationDir, name) };
  });

  for (const { source, destination } of artifacts)
    copyFileSync(source, destination);
  console.log(`Collected ${artifacts.length} native addons for ${version}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const artifactRoot = process.argv[2];
  if (!artifactRoot)
    throw new Error(
      'Usage: node scripts/release/collect-native.mjs <artifact-directory>'
    );
  collectNativeArtifacts(path.resolve(artifactRoot));
}
