/** @import { Plugin, ViteDevServer, UserConfig } from 'vite' */
/** @import { VElement } from 'retend/v-dom' */
/** @import { BuildOptions, StaticModule } from './types.js' */

import {
  buildPaths,
  HtmlOutputArtifact,
  RedirectOutputArtifact,
} from './server.js';
import { createServer, isRunnableDevEnvironment } from 'vite';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseAndWalk } from 'oxc-walker';
import MagicString from 'magic-string';

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
 * @returns {Plugin[]} A Vite plugin object.
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

  /** @type {(HtmlOutputArtifact | RedirectOutputArtifact)[]} */
  const outputArtifacts = [];
  /** @type {ViteDevServer} */
  let server;
  /** @type {UserConfig} */
  let serverConfig;

  /** @param {string} path */
  const loadServerModuleToJson = async (path) => {
    const environment = server.environments.ssr;
    if (!isRunnableDevEnvironment(environment)) {
      const message =
        'Cannot load server module because the server environment is not runnable.';
      console.warn(message);
      return '{}';
    }
    const { runner } = environment;

    // --- Load and Serialize Module Exports ---
    try {
      const loadedModule = await runner.import(path);
      /** @type {StaticModule} */
      const moduleCache = {};
      for (const [key, value] of Object.entries(loadedModule)) {
        const skipNonSerializable =
          typeof value === 'function' ||
          typeof value === 'symbol' ||
          typeof value === 'undefined';
        if (skipNonSerializable) continue;

        try {
          const stringified = JSON.stringify(value);
          const parsedValue = JSON.parse(stringified);
          const type = value instanceof Date ? 'date' : 'raw';
          moduleCache[key] = { type, value: parsedValue };
        } catch (serializeError) {
          const errorMsg =
            serializeError instanceof Error
              ? serializeError.message
              : String(serializeError);
          console.warn(
            `[retend-server] Value for export "${key}" in module ${path} is not JSON serializable and will be ignored by getServerSnapshot. Error: ${errorMsg}`
          );
        }
      }

      return JSON.stringify(moduleCache);
    } catch (importError) {
      const errorMsg =
        importError instanceof Error
          ? importError.message
          : String(importError);
      console.error(
        `[retend-server] Failed to import server module ${path} for serialization: ${errorMsg}`
      );
      if (importError instanceof Error) throw importError;
      throw new Error(String(importError));
    }
  };

  return [
    {
      name: 'vite-plugin-retend-server-snapshot',
      enforce: 'pre',

      async config(config) {
        serverConfig = {
          ...config,
          server: { ...config.server, middlewareMode: true },
          ssr: { ...config.ssr, target: 'node' },
          appType: 'custom',
          // It is expected that all the expected functionality, be it transformations or rewrites,
          // would have been handled by the main build process and cached. Having the plugins run again leads
          // to problems, as they would attempt to transform already transformed code.
          plugins: [],
        };
      },

      async transform(source, id) {
        if (!server) server = await createServer(serverConfig);

        const skipFile =
          id.includes('node_modules') ||
          id.includes('retend-server/dist/') ||
          !id.match(/\.[jt]sx?$/);
        if (skipFile) return null;

        const magicString = new MagicString(source);
        /** @type {Promise<void>[]} */
        const serverModuleResolvers = [];

        parseAndWalk(source, id, (node) => {
          if (node.type !== 'CallExpression') return;
          if (node.callee.type !== 'Identifier') return;
          if (node.callee.name !== 'getServerSnapshot') return;
          if (node.arguments.length !== 1) {
            const message = `getServerSnapshot() expects a single argument, but received ${node.arguments.length}`;
            throw new Error(message);
          }

          const argument = node.arguments[0];
          if (argument.type !== 'ArrowFunctionExpression') {
            const message = `getServerSnapshot() expects an arrow function as the argument, but received ${argument.type}`;
            throw new Error(message);
          }
          if (argument.body.type !== 'ImportExpression') {
            const message =
              'getServerSnapshot() expects a module importer function as its argument';
            throw new Error(message);
          }
          if (
            argument.body.source.type !== 'Literal' ||
            typeof argument.body.source.value !== 'string'
          ) {
            const message =
              'Cannot resolve server module. Import Functions should be statically analyzable.';
            throw new Error(message);
          }
          const moduleImporter = argument.body.source.value;

          const executor = async () => {
            const { start, end } = node;
            const resolvedModulePath = await this.resolve(moduleImporter, id);
            if (resolvedModulePath === null) {
              const message = `[retend-server] Could not resolve server module: ${moduleImporter} referenced in ${id}`;
              console.warn(message);
              return;
            }
            const path = resolvedModulePath.id;
            const moduleJson = await loadServerModuleToJson(path);
            const replacement = `getServerSnapshot(() => (${moduleJson}))`;
            magicString.overwrite(start, end, replacement);
          };

          serverModuleResolvers.push(executor());
        });

        await Promise.all(serverModuleResolvers);
        return { code: magicString.toString(), map: magicString.generateMap() };
      },
    },
    {
      name: 'vite-plugin-retend-server',
      enforce: 'post',

      // Handles SSR requests during development (`vite dev` or `vite serve`)
      async configureServer(devServer) {
        server = devServer;
        // Read the base HTML shell using the dev server's config
        const htmlShellPath = path.resolve(server.config.root, 'index.html');
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
          server.middlewares.use(async (req, res, next) => {
            const url = req.originalUrl;
            const skipUrl =
              !url ||
              url.includes('.') ||
              url.startsWith('/@') ||
              url.startsWith('/node_modules/') ||
              req.method !== 'GET';

            if (skipUrl) return next();

            try {
              /** @type {BuildOptions} */
              const buildOptions = {
                rootSelector,
                createRouterModule,
                htmlShell,
                server: server,
                skipRedirects: true,
              };

              const outputArtifacts = await buildPaths([url], buildOptions);
              if (!outputArtifacts || outputArtifacts.length !== 1) {
                console.error(
                  `[retend-server] Expected exactly one artifact for ${url}, but got ${
                    outputArtifacts?.length ?? 0
                  }.`
                );
                return next();
              }

              const artifact = outputArtifacts[0];
              if (!artifact || !(artifact instanceof HtmlOutputArtifact)) {
                return next();
              }

              const renderedHtml = await stringifyArtifact(artifact);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html');
              res.end(renderedHtml);
            } catch (e) {
              if (e instanceof Error) server.ssrFixStacktrace(e);
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
      async transformIndexHtml(html) {
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
            assetSourceToDistMap.set(
              path.resolve(obj.originalFileNames[0]),
              obj
            );
          }
        }

        const redirectLines = [];
        const promises = [];
        for (const artifact of outputArtifacts) {
          if (artifact instanceof RedirectOutputArtifact) {
            redirectLines.push(artifact.contents);
            continue;
          }

          const { name: fileName } = artifact;
          promises.push(
            stringifyArtifact(artifact, assetSourceToDistMap).then((source) => {
              this.emitFile({ type: 'asset', fileName, source });
            })
          );
        }

        if (redirectLines.length > 0) {
          this.emitFile({
            type: 'asset',
            fileName: '_redirects',
            source: redirectLines.join('\n'),
          });
        }

        await Promise.all(promises);
      },

      closeBundle() {
        server?.close();
      },
    },
  ];
}

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
  const { document } = contents;
  // Rewrite asset references
  document.findNodes((node) => {
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
