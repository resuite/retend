/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { Metadata, MetadataMap, RouteRecords as RouteRecordsRaw, RouteComponent } from './routeTree.js' */
/** @import { Lazy } from './lazy.js'; */
/** @import { RouterMiddleware } from './middleware.js'; */
/** @import { RouterNavigationEvent } from './events.js'; */
/** @import { Router } from './router.js'; */
/** @import { SourceCell } from '@adbl/cells'; */

/**
 * @typedef {Object} NavigationOptions
 *
 * @property {boolean} [replace]
 * Whether to replace the current history entry with the new path.
 */

/**
 * @typedef {{ metadata: Metadata }} RouteComponentArgs
 * @typedef {Lazy<RouteComponent> | RouteComponent} ComponentOrComponentLoader
 * @typedef {Omit<JSX.IntrinsicElements['div'], 'align'>} RouterOutletProps
 * @typedef {JSX.IntrinsicElements['a'] & ExtraLinkData} RouterLinkProps
 * @typedef {RouteRecordsRaw<ComponentOrComponentLoader>} RouteRecords
 * @typedef {RouteRecords[number]} RouteRecord
 */

/**
 * @typedef {Object} RouteLevel
 * @property {string} path
 * @property {RouteComponent} component
 */

/**
 * @typedef {Object} ExtraLinkData
 *
 * @property {boolean} [replace]
 * Whether to replace the current history entry with the new path.
 *
 * @property {JSX.ValueOrCell<(this: HTMLAnchorElement, event: RouterNavigationEvent) => void>} [onBeforeNavigate]
 * A callback function that is called before the navigation starts.
 * It receives a custom `RouterNavigationEvent` object as an argument.
 *
 * @property {JSX.ValueOrCell<(this: HTMLAnchorElement, event: RouterNavigationEvent) => void>} [onAfterNavigate]
 * A callback function that is called after the navigation ends.
 * It receives a custom `RouterNavigationEvent` object as an argument.
 */

/**
 * @typedef {Object} RouterInternalState
 * @property {SourceCell<RouteLevel[]>} routeChain
 * @property {MetadataMap} metadata
 */

/**
 * @typedef RouterOptions
 *
 * @property {RouteRecords} routes
 * The routes to be rendered by the router.
 *
 * @property {RouterMiddleware[]} [middlewares]
 * Middleware to be executed before each route change.
 *
 * @property {number} [maxRedirects]
 * The maximum number of redirects to allow before the router stops and throws an error.
 *
 * @property {boolean} [stackMode]
 * If set to `true`, the router will treat the routes as a stack, and will automatically
 * go back or forward based on the route history.
 *
 * @property {boolean} [useViewTransitions]
 * If set to `true`, the router will use browser view transitions when navigating between routes.
 *
 */

/**
 * @typedef RouterProviderProps
 * @property {Router} router
 * @property {() => JSX.Template} children
 */

/**
 * @typedef RouterData
 * @property {Router} router
 * @property {RouterInternalState} internalState
 * @property {number} depth
 * @property {MetadataMap} metadata
 */

export {};
