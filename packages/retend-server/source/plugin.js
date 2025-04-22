/** @import { Plugin, UserConfig, ViteDevServer } from 'vite' */
/** @import { VElement } from 'retend/v-dom' */
/** @import { BuildOptions } from './types.js' */

import {
  buildPaths,
  HtmlOutputArtifact,
  RedirectOutputArtifact,
} from './server.js';
import { createServer } from 'vite';
import path from 'node:path';

/**
 * @typedef {object} PluginOptions
 * @property {string[]} pages - An array of routes to generate static HTML files for (e.g., ['/', '/about']).
 * @property {string} routerModulePath - The path to the module exporting the `createRouter` function.
 * @property {string} [rootSelector] - The CSS selector for the root element.
 */

/**
 * A Vite plugin that generates static HTML files for `retend` applications after the Vite build.
 * @param {PluginOptions} options - Configuration options for the plugin.
 * @returns {Plugin} A Vite plugin object.
 */
export function retendSSG(options) {
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
  /** @type {(HtmlOutputArtifact | RedirectOutputArtifact)[]} */
  const outputArtifacts = [];
  /** @type {ViteDevServer} */
  let server;

  return {
    name: 'vite-plugin-retend-server',
    apply: 'build',
    enforce: 'post',

    config(config) {
      viteConfig = config;
      return config;
    },

    async transformIndexHtml(html) {
      /** @type {UserConfig} */
      const serverConfig = {
        ...viteConfig,
        server: { ...viteConfig.server, middlewareMode: true },
        ssr: { ...viteConfig.ssr, target: 'node' },
        appType: 'custom',
        // It is expected that all the expected functionality, be it transformations or rewrites,
        // would have been handled by the main build process and cached. Having the plugins run again leads
        // to problems, as they would attempt to transform already transformed code.
        plugins: [],
      };

      server = await createServer(serverConfig);

      /** @type {BuildOptions} */
      const buildOptions = {
        rootSelector,
        createRouterModule,
        htmlShell: html,
        server,
      };

      outputArtifacts.push(...(await buildPaths(pages, buildOptions)));
      return html;
    },

    async generateBundle(_, bundle) {
      const assetSourceToDistMap = new Map();
      for (const obj of Object.values(bundle)) {
        if ('originalFileNames' in obj) {
          assetSourceToDistMap.set(path.resolve(obj.originalFileNames[0]), obj);
        }
      }

      const redirectionLines = [];
      const promises = [];
      for (const artifact of outputArtifacts) {
        if (artifact instanceof HtmlOutputArtifact) {
          const { name: fileName, contents, stringify } = artifact;
          // Rewrite asset references
          contents.document.findNodes((node) => {
            if (node.nodeType !== 1) return false;
            const element = /** @type {VElement} */ (node);

            const tagName = element.tagName.toLowerCase();
            if (!/^script|style|link|img$/i.test(tagName)) return false;

            const attrName = tagName === 'link' ? 'href' : 'src';
            const attrValue = element.getAttribute(attrName);
            if (!attrValue || attrValue.includes('://')) return false;
            const fullPath = path.resolve(
              attrValue.startsWith('/') ? attrValue.slice(1) : attrValue
            );
            const rewrittenAsset = assetSourceToDistMap.get(fullPath);
            if (!rewrittenAsset) return false;

            element.setAttribute(attrName, rewrittenAsset.fileName);
            return true;
          });

          promises.push(
            stringify().then((source) => {
              this.emitFile({ type: 'asset', fileName, source });
            })
          );
        } else {
          // artifact is a redirect.
          redirectionLines.push(artifact.contents);
        }
      }

      if (redirectionLines.length > 0) {
        this.emitFile({
          type: 'asset',
          fileName: '_redirects',
          source: redirectionLines.join('\n'),
        });
      }

      await Promise.all(promises);
    },

    closeBundle() {
      server?.close();
    },
  };
}
