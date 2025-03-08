/** @import { Plugin, UserConfig } from 'vite' */
/** @import { BuildOptions, OutputArtifact } from './types.js' */

import { buildPaths } from './server.js';

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
    enforce: 'post',

    config(config) {
      viteConfig = config;
      return config;
    },

    async transformIndexHtml(html) {
      /** @type {BuildOptions} */
      const buildOptions = {
        rootSelector,
        createRouterModule,
        htmlShell: html,
        viteConfig,
      };
      outputs.push(...(await buildPaths(pages, buildOptions)));
      const transformed = outputs.find((o) => o.name === 'index.html');
      if (transformed) {
        outputs.splice(outputs.indexOf(transformed), 1);
        return transformed.contents;
      }
      return html;
    },

    generateBundle() {
      for (const output of outputs) {
        this.emitFile({
          type: 'asset',
          fileName: output.name,
          source: output.contents,
        });
      }
    },
  };
}

export default unfinishedSSG;
