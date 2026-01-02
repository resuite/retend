/** @import { Plugin, UserConfig, ResolvedConfig, RunnableDevEnvironmentContext, RunnableDevEnvironment } from 'vite' */
// /** @import { EmittedFile } from 'rollup' */
/** @import { VElement } from './v-dom/index.js' */
/** @import { AsyncStorage } from './types.js' */
/** @import { Router } from 'retend/router' */

import {
  buildPath,
  HtmlOutputArtifact,
  RedirectOutputArtifact,
} from './server.js';
import path, { resolve } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { resolveConfig, createRunnableDevEnvironment } from 'vite';

/**
 * @typedef {object} SharedData
 * @property {AsyncLocalStorage<AsyncStorage>} asyncLocalStorage
 * @property {PluginOptions} options
 * @property {boolean} sharedContextDefined
 * @property {UserConfig | null} ssgEnvironmentConfig
 * @property {ResolvedConfig | null} resolvedConfig

 */

/**
 * @typedef {RunnableDevEnvironment & {
 *  runner: { [asyncLocalStorageSymbol]?: AsyncLocalStorage<AsyncStorage> }
 * }} SSGEnvironment
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
 * import { Router } from 'retend/router';
 *
 * export function createRouter() {
 *   return new Router({ routes: [...] });
 * }
 * ```
 *
 * @property {string} [rootSelector]
 * The CSS selector for the root element. Defaults to '#app'.
 *
 * @property {boolean} [inlineEnvironmentImports]
 * Changes the import mode in SSR from `ModuleRunner.evaluator.runExternalModule`
 * to `ModuleRunner.import(..)`
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
    resolvedConfig: null,
  };

  return [...staticBuildPlugins(sharedData)];
}

const asyncLocalStorageSymbol = Symbol('asyncLocalStorage');

/**
 *
 * @param {SharedData} sharedData
 * @returns {Plugin[]}
 */
function staticBuildPlugins(sharedData) {
  /** @type {(HtmlOutputArtifact | RedirectOutputArtifact)[]} */
  const outputArtifacts = [];
  /** @type {any[]} */
  const outputFileEmissions = [];
  /** @type {Record<string, Set<string>>} */
  const cssDeps = Object.create(null);

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
          resolve: {
            ...config_.resolve,
            dedupe: ['retend', 'retend-web', 'retend-server', 'retend-utils'],
          },
          server: {
            ...config_.server,
            middlewareMode: true,
            perEnvironmentStartEndDuringDev: true,
          },
          ssr: {
            ...config_.ssr,
            target: 'node',
            noExternal: [/retend.*/, /@adbl\/cells/],
          },
          appType: 'custom',
          optimizeDeps: {
            exclude: ['retend', 'retend-web', 'retend-server', 'retend-utils'],
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

      async configResolved(config) {
        sharedData.resolvedConfig = config;
      },

      augmentChunkHash({ modules, viteMetadata }) {
        const paths = Object.keys(modules).filter((id) => id.endsWith('.css'));
        const builtPaths = viteMetadata?.importedCss;
        if (!builtPaths) return;

        for (const source of paths) {
          const outputChunkSet = cssDeps[source] || new Set();
          for (const value of builtPaths.values()) {
            outputChunkSet.add(value);
          }
          cssDeps[source] = outputChunkSet;
        }
      },

      async transformIndexHtml(htmlShell, ctx) {
        let transformedHtml = htmlShell;
        if (!ctx.bundle) {
          console.error('Could not find output bundle context at build time.');
          return transformedHtml;
        }

        // Clear previous artifacts and emissions for this build
        outputArtifacts.length = 0;
        outputFileEmissions.length = 0;

        const {
          options: { routerModulePath, rootSelector },
          asyncLocalStorage,
          ssgEnvironmentConfig,
        } = sharedData;
        if (!ssgEnvironmentConfig) throw new Error('No resolved config found');

        /** @type {RunnableDevEnvironmentContext} */
        const envCtx = {
          hot: false,
          runnerOptions: {
            hmr: {
              logger: false,
            },
          },
        };

        const config = await resolveConfig(ssgEnvironmentConfig, 'serve');
        const environment = /** @type {SSGEnvironment} */ (
          createRunnableDevEnvironment('retend_ssg', config, envCtx)
        );
        await environment.init();
        await environment.pluginContainer.buildStart();
        const { runner } = environment;

        const evaluate = sharedData.options.inlineEnvironmentImports
          ? runner.import
          : runner.evaluator.runExternalModule;

        const vdomModule = await evaluate('retend-server/v-dom');
        const retendRouterModule = await evaluate('retend/router');
        const ctxModule = await evaluate('retend/context');
        const retendModule = await evaluate('retend');
        const routerModule = /** @type {{ createRouter: () => Router }} */ (
          await runner.import(resolve(routerModulePath))
        );

        if (routerModule.createRouter === undefined) {
          throw new Error(
            'The router module must export a createRouter function. Please add export function createRouter() { return new Router({ ... }); } to your router module.'
          );
        }
        await defineSharedGlobalContext(sharedData, ctxModule.setGlobalContext);

        console.log('\n');
        const buildingPages = [];

        for (const page of pages) {
          console.log('Building page:', page);
          const buildOptions = {
            rootSelector,
            htmlShell,
            asyncLocalStorage,
            routerModulePath,
            ssg: environment,
            retendModule,
            vdomModule,
            retendRouterModule,
            routerModule,
          };
          environment.runner[asyncLocalStorageSymbol] = asyncLocalStorage;

          buildingPages.push(
            buildPath(page, buildOptions).then((artifacts) => {
              outputArtifacts.push(...artifacts);
            })
          );
        }
        await Promise.all(buildingPages);

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
            stringifyArtifact(artifact, sourceDistMap, cssDeps).then(
              (source) => {
                if (fileName === 'index.html') transformedHtml = source;
                else {
                  outputFileEmissions.push({ type: 'asset', fileName, source });
                }
              }
            )
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
        await environment.close();
        return transformedHtml;
      },

      async generateBundle() {
        // Emit all files that were prepared in transformIndexHtml
        for (const fileEmit of outputFileEmissions) {
          this.emitFile(fileEmit);
        }
      },
    },
    {
      name: 'vite-plugin-css-lazy-import-helper',
      apply: 'serve',
      enforce: 'pre',

      applyToEnvironment(env) {
        return env.name === 'retend_ssg';
      },
    },
  ];
}

/**
 * @async
 * @param {HtmlOutputArtifact} artifact
 * @param {Map<string, { fileName: string }>} assetSourceToDistMap
 * @param {Record<string, Set<string>>} cssDeps
 * @returns {Promise<string>}
 */
async function stringifyArtifact(artifact, assetSourceToDistMap, cssDeps) {
  const { contents, stringify, cssImports } = artifact;
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

  for (const cssImport of cssImports) {
    const links = cssDeps[cssImport];
    if (!links) continue;
    for (const link of links) {
      const hasLink = document.head.findNode((node) => {
        if (node.nodeType !== 1) return false;
        const element = /** @type {VElement} */ (node);
        if (element.tagName.toLowerCase() !== 'link') return false;
        const elementHref = element.getAttribute('href');
        const href = elementHref?.startsWith('/')
          ? elementHref.slice(1)
          : elementHref;
        return href === link;
      });
      if (!hasLink) {
        const linkTag = document.createElement('link');
        linkTag.setAttribute('rel', 'stylesheet');
        linkTag.setAttribute('href', link);
        linkTag.setAttribute('data-retend-preload', 'true');
        document.head.append(linkTag);
      }
    }
  }

  const source = await stringify();
  return source;
}

/**
 * Sets the global context retriever for the current build or
 * SSR environment.
 * @param {SharedData} sharedData
 * @param {Function} setGlobalContext
 */
async function defineSharedGlobalContext(sharedData, setGlobalContext) {
  const { asyncLocalStorage } = sharedData;

  const context = {
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
