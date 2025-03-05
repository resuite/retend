/** @import { Plugin, UserConfig } from 'vite' */
/** @import { BuildOptions } from './types.js' */

import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPaths, writeArtifactsToDisk } from './server.js';

/**
 * @typedef {object} PluginOptions
 * @property {string[]} paths - An array of routes to generate static HTML files for (e.g., ['/', '/about']).
 * @property {string} routerModulePath - The path to the module exporting the `createRouter` function.
 * @property {string} [rootSelector] - The CSS selector for the root element.
 */

/**
 * A Vite plugin that generates static HTML files for `@adbl/unfinished` applications after the Vite build.
 * @param {PluginOptions} options - Configuration options for the plugin.
 * @returns {Plugin} A Vite plugin object.
 */
export default function unfinishedSSG(options) {
  const {
    paths,
    routerModulePath: createRouterModule,
    rootSelector = '#app',
  } = options;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    throw new Error(
      'vite-unfinished-ssg: The `paths` option must be a non-empty array of strings.'
    );
  }

  if (!createRouterModule || typeof createRouterModule !== 'string') {
    throw new Error(
      'vite-unfinished-ssg: The `routerPath` option must be a string.'
    );
  }

  /** @type {UserConfig} */
  let viteConfig;

  return {
    name: 'vite-unfinished-ssg',
    apply: 'build',

    configResolved(resolvedConfig) {
      viteConfig = /** @type {*} */ (resolvedConfig);
    },

    async writeBundle() {
      const outDir = viteConfig.build?.outDir || 'dist';
      const dist = resolve(outDir);

      const htmlShell = await fs.readFile(`${dist}/index.html`, 'utf-8');
      /** @type {BuildOptions} */
      const buildOptions = {
        rootSelector,
        createRouterModule,
        htmlShell,
        viteConfig,
      };
      const outputs = await buildPaths(paths, buildOptions);
      await writeArtifactsToDisk(outputs, { outDir });

      console.log('vite-unfinished-ssg: SSG build complete.');
    },
  };
}
