/** @import { Plugin, UserConfig, RunnableDevEnvironmentContext } from 'vite' */
/** @import { EmittedFile } from 'rollup' */
/** @import { VElement } from 'retend/v-dom' */
/** @import { AsyncStorage, BuildOptions } from './types.js' */

import {
  buildPaths,
  HtmlOutputArtifact,
  RedirectOutputArtifact,
} from './server.js';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Modes, setGlobalContext } from 'retend/context';
import { resolveConfig, createRunnableDevEnvironment } from 'vite';

/**
 * @typedef {object} SharedData
 * @property {AsyncLocalStorage<AsyncStorage>} asyncLocalStorage
 * @property {PluginOptions} options
 * @property {boolean} sharedContextDefined
 * @property {UserConfig | null} ssgEnvironmentConfig

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
    asyncLocalStorage: new AsyncLocalStorage(),
    options,
    sharedContextDefined: false,
    ssgEnvironmentConfig: null,
  };

  return [...staticBuildPlugins(sharedData)];
}

/**
 *
 * @param {SharedData} sharedData
 * @returns {Plugin[]}
 */
function staticBuildPlugins(sharedData) {
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
      name: 'vite-plugin-retend-server-post-build',
      apply: 'build',
      enforce: 'post',

      applyToEnvironment(env) {
        // Only apply in the client build.
        return env.name === 'client';
      },

      async config(config_) {
        sharedData.ssgEnvironmentConfig = {
          ...config_,
          dev: {
            ...config_.dev,
            moduleRunnerTransform: true,
          },
          server: {
            ...config_.server,
            middlewareMode: true,
            perEnvironmentStartEndDuringDev: true,
          },
          ssr: { ...config_.ssr, target: 'node' },
          appType: 'custom',
          optimizeDeps: {
            exclude: ['retend'],
          },
          environments: {
            retend_ssg: {},
          },
          // It is expected that all the expected functionality, be it transformations or rewrites,
          // would be handled by the main build process and cached. Having the plugins run again leads
          // to problems, as they would attempt to transform already transformed code.
          plugins: [],
        };
      },

      async transformIndexHtml(htmlShell_, ctx) {
        let transformedHtml = htmlShell_;
        if (!ctx.bundle) {
          console.error('Could not find output bundle context at build time.');
          return transformedHtml;
        }

        // Clear previous artifacts and emissions for this build
        outputArtifacts.length = 0;
        outputFileEmissions.length = 0;

        await defineSharedGlobalContext(sharedData);
        const {
          options: { routerModulePath, rootSelector },
          asyncLocalStorage,
          ssgEnvironmentConfig,
        } = sharedData;
        if (!ssgEnvironmentConfig) throw new Error('No resolved config found');

        /** @type {RunnableDevEnvironmentContext} */
        const envContext = {
          hot: false,
          runnerOptions: {
            hmr: {
              logger: false,
            },
          },
        };

        const config = await resolveConfig(ssgEnvironmentConfig, 'serve');
        const ssg = createRunnableDevEnvironment(
          'retend_ssg',
          config,
          envContext
        );
        await ssg.init();
        await ssg.pluginContainer.buildStart();

        /** @type {BuildOptions} */
        const buildOptions = {
          rootSelector,
          htmlShell: htmlShell_,
          asyncLocalStorage,
          routerModulePath,
          ssg,
        };

        // Generate artifacts using buildPaths
        outputArtifacts.push(...(await buildPaths(pages, buildOptions)));

        // Create source to dist map for asset rewriting
        const sourceDistMap = new Map();
        for (const obj of Object.values(ctx.bundle)) {
          if ('originalFileNames' in obj && obj.originalFileNames.length) {
            sourceDistMap.set(path.resolve(obj.originalFileNames[0]), obj);
          }
        }

        // Process artifacts and prepare file emissions
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
        await ssg.close();
        return transformedHtml;
      },

      async generateBundle() {
        // Emit all files that were prepared in transformIndexHtml
        for (const fileEmit of outputFileEmissions) {
          this.emitFile(fileEmit);
        }
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

/**
 * Sets the global context retriever for the current build or
 * SSR environment.
 * @param {SharedData} sharedData
 */
async function defineSharedGlobalContext(sharedData) {
  const { asyncLocalStorage } = sharedData;

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
