/** @import { Plugin } from 'vite' */
/** @import { EmittedFile } from 'rollup' */
/** @import { VElement } from 'retend/v-dom' */
/** @import { AsyncStorage, BuildOptions, StaticModule } from './types.js' */
/** @import { ViteDevServer, UserConfig } from 'vite' */

import {
  buildPaths,
  HtmlOutputArtifact,
  RedirectOutputArtifact,
} from './server.js';
import { createServer, isRunnableDevEnvironment } from 'vite';
import path, { resolve } from 'node:path';
import { parseAndWalk } from 'oxc-walker';
import MagicString from 'magic-string';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Modes, setGlobalContext } from 'retend/context';

/**
 * @typedef {object} SharedData
 * @property {ViteDevServer | null} server
 * @property {AsyncLocalStorage<AsyncStorage>} asyncLocalStorage
 * @property {PluginOptions} options
 */

/**
 * @typedef {object} PluginOptions
 * @property {string[]} pages
 * An array of routes to generate static HTML files for (e.g., ['/', '/about']).
 *
 * @property {string} routerModulePath
 * The path to the module exporting the `createRouter` function.
 * It should look like this:
 * ```js
 * import { createWebRouter } from 'retend/router';
 *
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
  /** @type {SharedData} */
  const sharedData = {
    server: null,
    asyncLocalStorage: new AsyncLocalStorage(),
    options,
  };

  return [
    ...staticBuildPlugins(sharedData),
    serverSnapshotResolverPlugin(sharedData),
  ];
}

/**
 *
 * @param {SharedData} sharedData
 * @returns {Plugin[]}
 */
function staticBuildPlugins(sharedData) {
  /** @type {UserConfig} */
  let staticBuildConfig;
  /** @type {(HtmlOutputArtifact | RedirectOutputArtifact)[]} */
  const outputArtifacts = [];
  /** @type {EmittedFile[]} */
  const outputFileEmissions = [];

  const {
    options: { pages, routerModulePath },
  } = sharedData;

  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    throw new Error('The `paths` option must be a non-empty array of strings.');
  }

  if (!routerModulePath || typeof routerModulePath !== 'string') {
    throw new Error('The `routerPath` option must be a string.');
  }

  return [
    {
      name: 'vite-plugin-retend-server-pre-build',
      apply: 'build',
      enforce: 'pre',

      async config(config) {
        staticBuildConfig = {
          ...config,
          server: { ...config.server, middlewareMode: true },
          ssr: { ...config.ssr, target: 'node' },
          appType: 'custom',
          // It is expected that all the expected functionality, be it transformations or rewrites,
          // would be handled by the main build process and cached. Having the plugins run again leads
          // to problems, as they would attempt to transform already transformed code.
          plugins: [],
        };
        sharedData.server = await createServer(staticBuildConfig);
      },

      closeBundle() {
        sharedData.server?.close();
      },
    },
    {
      name: 'vite-plugin-retend-server-post-build',
      apply: 'build',
      enforce: 'post',

      async transformIndexHtml(html, ctx) {
        let transformedHtml = html;
        if (!ctx.bundle) {
          console.error('Could not find output bundle context at build time.');
          return transformedHtml;
        }

        if (!sharedData.server) {
          console.warn(
            'The server was not initialized during static pre-build.'
          );
          return;
        }
        const environment = sharedData.server.environments.ssr;
        if (!isRunnableDevEnvironment(environment)) {
          console.warn(
            'The SSR environment is not runnable. Skipping SSG for this build.'
          );
          return;
        }

        await defineSharedGlobalContext(sharedData);
        const { runner } = environment;
        const {
          options: { routerModulePath, rootSelector },
        } = sharedData;
        const routerModule = await runner.import(resolve(routerModulePath));
        /** @type {BuildOptions} */
        const buildOptions = {
          rootSelector,
          htmlShell: html,
          asyncLocalStorage: sharedData.asyncLocalStorage,
          routerModule,
          moduleRunner: environment.runner,
        };

        outputArtifacts.push(...(await buildPaths(pages, buildOptions)));

        const sourceDistMap = new Map();
        for (const obj of Object.values(ctx.bundle)) {
          if ('originalFileNames' in obj && obj.originalFileNames.length) {
            sourceDistMap.set(path.resolve(obj.originalFileNames[0]), obj);
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
            stringifyArtifact(artifact, sourceDistMap).then((source) => {
              if (fileName === 'index.html') {
                transformedHtml = source;
              } else {
                outputFileEmissions.push({ type: 'asset', fileName, source });
              }
            })
          );
        }

        if (redirectLines.length > 0) {
          outputFileEmissions.push({
            type: 'asset',
            fileName: '_redirects',
            source: redirectLines.join('\n'),
          });
        }

        await Promise.all(promises);
        return transformedHtml;
      },

      async generateBundle() {
        for (const fileEmit of outputFileEmissions) {
          this.emitFile(fileEmit);
        }
      },
    },
  ];
}

/**
 * @param {SharedData} sharedData
 * @returns {Plugin}
 */
function serverSnapshotResolverPlugin(sharedData) {
  return {
    name: 'vite-plugin-retend-server-snapshot',
    enforce: 'pre',

    configureServer(server_) {
      sharedData.server = server_;
    },

    async transform(source, id) {
      const skipFile =
        id.includes('node_modules') ||
        id.includes('retend-server/dist/') ||
        id.includes('retend/dist/') ||
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
          const { server } = sharedData;
          if (!server) {
            const message =
              '[retend-server] Server not initialized. Cannot resolve server module.';
            console.warn(message);
            return;
          }
          const moduleJson = await loadModuleToJson(path, sharedData);
          const replacement = `getServerSnapshot(()=>(${moduleJson}))`;
          magicString.overwrite(start, end, replacement);
        };

        serverModuleResolvers.push(executor());
      });

      await Promise.all(serverModuleResolvers);
      return { code: magicString.toString(), map: magicString.generateMap() };
    },
  };
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

/**
 * @param {string} path
 * @param {SharedData} sharedData
 */
const loadModuleToJson = async (path, sharedData) => {
  const { server, asyncLocalStorage } = sharedData;
  const environment = server?.environments.ssr;
  if (!environment || !isRunnableDevEnvironment(environment)) {
    const message =
      'Serialization failed: Environment does not support server snapshots.';
    console.warn(message);
    return '{}';
  }
  const { runner } = environment;
  await defineSharedGlobalContext(sharedData);

  // --- Load and Serialize Module Exports ---

  const executor = async () => {
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

  const { VWindow } = await runner.import('retend/v-dom');

  const globalContextStore = {
    window: new VWindow(),
    path: '/',
    teleportIdCounter: { value: 0 },
    consistentValues: new Map(),
    globalData: new Map(),
  };
  return await asyncLocalStorage.run(globalContextStore, async () => {
    return await executor();
  });
};

let sharedContextDefined = false;
/**
 * Sets the global context retriever for the current build or
 * SSR environment.
 * @param {SharedData} sharedData
 */
async function defineSharedGlobalContext(sharedData) {
  const { asyncLocalStorage } = sharedData;
  if (sharedContextDefined) return;
  sharedContextDefined = true;

  const context = {
    mode: Modes.VDom,
    get window() {
      const store = asyncLocalStorage.getStore();
      if (!store) throw new Error('No store found');
      return store.window;
    },
    get teleportIdCounter() {
      const store = asyncLocalStorage.getStore();
      if (!store) throw new Error('No store found');
      return store.teleportIdCounter;
    },
    get consistentValues() {
      const store = asyncLocalStorage.getStore();
      if (!store) throw new Error('No store found');
      return store.consistentValues;
    },
    get globalData() {
      const store = asyncLocalStorage.getStore();
      if (!store) throw new Error('No store found');
      return store.globalData;
    },
  };
  setGlobalContext(context);
}
