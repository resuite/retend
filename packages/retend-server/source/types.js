/** @import { Router } from 'retend/router' */
/** @import { VWindow } from 'retend/v-dom' */
/** @import { AsyncLocalStorage } from 'node:async_hooks' */
/** @import { ViteDevServer } from 'vite' */

/**
 * @typedef RouterModule
 * A module that exports a function that creates a router. This will
 * be the base used to create your routers on the server and client.
 *
 * @property {() => Router} createRouter
 * A function that returns a web router.
 */

/**
 * @typedef {Object} ServerContext
 * @property {string} path
 * @property {string} rootSelector
 * @property {Record<string, unknown>} shell
 * @property {Record<string, unknown>} consistentValues
 */

/**
 * @typedef {Object} BuildOptions
 * @property {string} [htmlShell]
 * @property {string} [rootSelector]
 * @property {string} [createRouterModule]
 * @property {ViteDevServer} server
 * @property {Map<string, string>} serverModulesAddressMap
 * @property {boolean} [skipRedirects]
 * @property {Record<string, StaticModule>} staticImports
 */

/**
 * @typedef {Object} WriteArtifactsOptions
 * @property {string} [outDir]
 * @property {boolean} [clean]
 */

/**
 * @typedef {Object} ViteBuildResult
 * @property {Array<{code: string, source: string, fileName: string}>} output
 */

/**
 * @typedef {Object} AsyncStorage
 * @property {VWindow} window
 * @property {string} path
 * @property {{ value: number }} teleportIdCounter
 * @property {Map<string, unknown>} consistentValues
 * @property {Map<string, any>} globalData
 */

/**
 * @typedef {Object} RenderOptions
 * @property {string} path
 * @property {AsyncLocalStorage<AsyncStorage>} asyncLocalStorage
 * @property {string} htmlShell
 * @property {string} rootSelector
 * @property {typeof import('retend')} retendModule
 * @property {{ createRouter: () => Router, context: typeof import('retend/context') }} routerModule
 * @property {typeof import('retend/render')} retendRenderModule
 * @property {typeof import('retend/v-dom')} retendVDomModule
 * @property {boolean} skipRedirects
 * @property {Map<string, string>} serverModulesAddressMap
 * @property {Record<string, StaticModule>} staticImports
 */

/**
 * @typedef {{ type: 'raw', value: any }} StaticPrimitiveImport
 */

/**
 * @typedef {{ type: 'date', value: any }} StaticDateImport
 */

/**
 * @typedef {{ type: 'function', returnValue: any, isAsync: boolean }} StaticFunctionImport
 */

/**
 * @typedef {Record<string, StaticPrimitiveImport | StaticFunctionImport | StaticDateImport>} StaticModule
 */
