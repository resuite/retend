/** @import { Plugin, UserConfig, ViteDevServer } from 'vite' */
/** @import { BuildOptions } from './types.js' */

import { VElement } from '../../retend/dist/v-dom/index.js';
import {
  buildPaths,
  HtmlOutputArtifact,
  RedirectOutputArtifact,
} from './server.js';
import { createServer } from 'vite';

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
      const redirectionLines = [];
      for (const artifact of outputArtifacts) {
        if (artifact instanceof HtmlOutputArtifact) {
          // Rewrite asset references
          artifact.contents.document.findNodes((node) => {
            if (!(node instanceof VElement)) return false;

            const tagName = node.tagName.toLowerCase();
            if (/^script|style|link|img$/i.test(tagName)) return false;

            const attrName = tagName === 'link' ? 'href' : 'src';
            const attrValue = node.getAttribute(attrName);
            if (!attrValue) return false;
            const rewrittenAsset = bundle[attrValue];
            if (!rewrittenAsset) return false;

            node.setAttribute(attrName, rewrittenAsset.fileName);
            return true;
          });

          this.emitFile({
            type: 'asset',
            fileName: artifact.name,
            source: await artifact.stringify(),
          });
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
    },

    closeBundle() {
      server?.close();
    },
  };
}
