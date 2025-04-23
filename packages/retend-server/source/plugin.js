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
import { readFileSync } from 'node:fs';
// import { readFile, readFileSync } from 'node:fs';

/**
 * @typedef {object} PluginOptions
 * @property {string[]} pages
 * An array of routes to generate static HTML files for (e.g., ['/', '/about']).
 *
 * @property {string} routerModulePath
 * The path to the module exporting the `createRouter` function and `context` module.
 * It should look like this:
 * ```js
 * import { createWebRouter } from 'retend/router';
 *
 * export * as context from 'retend/context';
 * export function createRouter() {
 *   return createWebRouter({ routes: [...] });
 * }
 * ```
 *
 * @property {string} [rootSelector]
 * The CSS selector for the root element. Defaults to '#app'.
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
    enforce: 'post', // Run after Vite core plugins

    config(config) {
      viteConfig = config;
      return config;
    },

    // Handles SSR requests during development (`vite dev` or `vite serve`)
    async configureServer(devServer) {
      // Read the base HTML shell using the dev server's config
      const htmlShellPath = path.resolve(devServer.config.root, 'index.html');
      let htmlShell;
      try {
        htmlShell = readFileSync(htmlShellPath, 'utf-8');
      } catch (error) {
        console.error(
          `[retend-server] Failed to read HTML shell at ${htmlShellPath}:`,
          error
        );
        return;
      }

      return () => {
        devServer.middlewares.use(async (req, res, next) => {
          // Use originalUrl to capture query params etc.
          const url = req.originalUrl;
          console.log('Handling request for:', url);

          // Basic check to skip assets, HMR, API calls etc.
          // Adjust this logic if necessary for your specific routing needs.
          if (
            !url ||
            url.includes('.') ||
            url.startsWith('/@') ||
            url.startsWith('/node_modules/') ||
            req.method !== 'GET'
          ) {
            return next(); // Pass request to next middleware (likely Vite's default handlers)
          }

          console.log(`[retend-server] Intercepting request for: ${url}`);

          try {
            // Prepare options for buildPaths, using the dev server
            /** @type {BuildOptions} */
            const buildOptions = {
              rootSelector,
              createRouterModule,
              htmlShell, // Pass the read HTML shell content
              server: devServer, // Pass the ViteDevServer instance for module loading etc.
              skipRedirects: true, // Skip generating redirect artifacts in dev SSR
            };

            // Use buildPaths to render the requested URL, expecting only HTML artifacts
            const outputArtifacts = await buildPaths([url], buildOptions);

            // Assert that exactly one artifact is returned and it's not a redirect
            if (!outputArtifacts || outputArtifacts.length !== 1) {
              console.error(
                `[retend-server] Expected exactly one artifact for ${url}, but got ${
                  outputArtifacts?.length ?? 0
                }.`
              );
              return next(); // Proceed to other middlewares or Vite's 404
            }

            const artifact = outputArtifacts[0];

            // Since skipRedirects is true, we should not receive RedirectOutputArtifact
            if (artifact instanceof RedirectOutputArtifact) {
              console.error(
                `[retend-server] Received unexpected RedirectOutputArtifact for ${url} despite skipRedirects=true.`
              );
              return next();
            }

            // Expecting a single HTML artifact for a single URL request in dev SSR
            if (!artifact || !(artifact instanceof HtmlOutputArtifact))
              console.warn(
                `[retend-server] No output artifact generated for URL: ${url}`
              );
            const renderedHtml = await stringifyArtifact(artifact);

            // Send the final HTML response
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(renderedHtml);
            console.log(`[retend-server] SSR rendered ${url}`);
          } catch (e) {
            if (e instanceof Error) {
              devServer.ssrFixStacktrace(e);
            }
            console.error(
              `[retend-server] SSR Error processing ${url}:`,
              e instanceof Error ? e.message : e
            );
            next(e);
          }
        });
      };
    },

    // --- Build-time hooks (SSG) ---

    // transformIndexHtml is used during build to prepare for SSG
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
          const { name: fileName } = artifact;
          promises.push(
            stringifyArtifact(artifact, assetSourceToDistMap).then((source) => {
              this.emitFile({ type: 'asset', fileName, source });
            })
          );
        } else {
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

/**

/**
 * Rewrites asset references in the given artifact's document and returns the stringified result.
 *
 * This function scans for `<script>`, `<style>`, `<link>` and `<img>` elements
 * and rewrites their 'src' or 'href' attributes based on the provided assetSourceToDistMap.
 * Only local asset references (not containing '://') are considered for rewriting.
 *
 * @async
 * @param {HtmlOutputArtifact} artifact - The artifact object containing the document and a stringify method.
 * @param {Map<string, { fileName: string }>} [assetSourceToDistMap] - A map from source asset paths to their rewritten distribution info.
 * @returns {Promise<string>} The stringified artifact with rewritten asset references.
 */
async function stringifyArtifact(artifact, assetSourceToDistMap) {
  const { contents, stringify } = artifact;
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
    const rewrittenAsset = assetSourceToDistMap?.get(fullPath);
    if (!rewrittenAsset) return false;

    element.setAttribute(attrName, rewrittenAsset.fileName);
    return true;
  });

  const source = await stringify();
  return source;
}
