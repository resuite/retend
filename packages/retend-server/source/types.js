/** @import { Router } from 'retend/router' */
/** @import { VWindow } from 'retend/v-dom' */
/** @import { AsyncLocalStorage } from 'node:async_hooks' */
/** @import { ModuleRunner } from 'vite/module-runner' */

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
 * @property {ModuleRunner} moduleRunner
 * @property {boolean} [skipRedirects]
 * @property {AsyncLocalStorage<AsyncStorage>} asyncLocalStorage
 * @property {{ createRouter: () => Router }} routerModule
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
 * @property {{ createRouter: () => Router }} routerModule
 * @property {typeof import('retend/render')} retendRenderModule
 * @property {typeof import('retend/v-dom')} retendVDomModule
 * @property {boolean} skipRedirects
 */

/**
 * @typedef {{ type: 'raw', value: any }} StaticPrimitiveImport
 */

/**
 * @typedef {{ type: 'template', value: string }} StaticTemplateImport
 */

/**
 * @typedef {{ type: 'date', value: any }} StaticDateImport
 */

/**
 * @typedef {Record<string, StaticPrimitiveImport | StaticDateImport | StaticTemplateImport>} StaticModule
 */
