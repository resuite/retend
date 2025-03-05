/** @import { Plugin, UserConfig } from 'vite' */
/** @import { BuildOptions, OutputArtifact } from './types.js' */

import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPaths, writeArtifactsToDisk } from './server.js';

/**
 * @typedef {object} PluginOptions
 * @property {string[]} pages - An array of routes to generate static HTML files for (e.g., ['/', '/about']).
 * @property {string} routerModulePath - The path to the module exporting the `createRouter` function.
 * @property {string} [rootSelector] - The CSS selector for the root element.
 */

/**
 * A Vite plugin that generates static HTML files for `@adbl/unfinished` applications after the Vite build.
 * @param {PluginOptions} options - Configuration options for the plugin.
 * @returns {Plugin} A Vite plugin object.
 */
export function unfinishedSSG(options) {
  const {
    pages,
    routerModulePath: createRouterModule,
    rootSelector = '#app',
  } = options;

  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    throw new Error('The `paths` option must be a non-empty array of strings.');
  }

  if (!createRouterModule || typeof createRouterModule !== 'string') {
    throw new Error('The `routerPath` option must be a string.');
  }

  /** @type {UserConfig} */
  let viteConfig;
  /** @type {OutputArtifact[]} */
  const outputs = [];

  return {
    name: 'vite-plugin-unfinished-ssg',
    apply: 'build',

    config(config) {
      viteConfig = config;
      return config;
    },

    async buildEnd() {
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
      outputs.push(...(await buildPaths(pages, buildOptions)));
    },

    async writeBundle() {
      const outDir = viteConfig.build?.outDir || 'dist';
      await writeArtifactsToDisk(outputs, { outDir });
    },
  };
}

export default unfinishedSSG;
