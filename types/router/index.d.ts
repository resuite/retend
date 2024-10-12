/**
 * Creates a new web-based router instance with the provided route configurations.
 *
 * This function sets up the necessary event listeners for handling browser history events and initial page load, and assigns the created router instance to the global `ROUTER_INSTANCE` variable.
 *
 * @param {RouterOptions} routerOptions - The options object for configuring the router.
 * @returns {Router} The created router instance.
 */
export function createWebRouter(routerOptions: RouterOptions): Router;
/**
 * Returns the singleton instance of the Router class.
 *
 * The Router class manages the routing logic and provides methods for navigating between routes, rendering components, and handling browser history events.
 *
 * @returns {Router} The Router instance.
 *
 * @example
 * // Get the router instance
 * const router = useRouter();
 *
 * // Navigate to a new route
 * router.navigate('/about');
 */
export function useRouter(): Router;
/**
 * Wrapper function for defining route records.
 *
 * @param {RouteRecords} routes
 */
export function defineRoutes(routes: RouteRecords): RouteRecords;
export * from "./lazy.js";
export * from "./routeTree.js";
export * from "./middleware.js";
/**
 * @typedef RouterOptions
 * @property {RouteRecords} routes
 * The routes to be rendered by the router.
 * @property {RouterMiddleware[]} [middlewares]
 * Middleware to be executed before each route change.
 * @property {number} [maxRedirects]
 * The maximum number of redirects to allow before the router stops and throws an error.
 */
export class Router {
    /** @param {RouterOptions} routeOptions */
    constructor(routeOptions: RouterOptions);
    /** @private @type {string} */
    private id;
    /** @private @type {HTMLElement[]} */
    private links;
    /** @type {Map<string, string>} */
    params: Map<string, string>;
    /** @private RouteTree<ReturnType<import('../component.js').ElementConstructor>> */
    private routeTree;
    /** @private RouterMiddleware[] */
    private middlewares;
    /** @private @type {import('./middleware.js').RouteData | null} */
    private currentPath;
    /** @private @type {number} */
    private redirectStackCount;
    /** @private @type {number} */
    private maxRedirects;
    /** @type {Promise<boolean>} */
    rendering: Promise<boolean>;
    /**
     * Defines an anchor element and handles click events to navigate to the specified route.
     *
     * @type {(props: JSX.JsxHtmlAnchorElement) => HTMLAnchorElement}
     * @param {JSX.JsxHtmlAnchorElement} props - The component props.
     * @returns {HTMLAnchorElement} The rendered `<router-link>` component.
     */
    Link: (props: JSX.JsxHtmlAnchorElement) => HTMLAnchorElement;
    /**
     * Defines an element that serves as the router outlet, rendering the component
     * associated with the current route.
     *
     * This component is used internally by the `Router` class to handle route changes and
     * render the appropriate component.
     * @type {(props: JSX.JsxHtmlDivElement) => HTMLDivElement}
     * @param {JSX.JsxHtmlDivElement} props
     */
    Outlet: (props: JSX.JsxHtmlDivElement) => HTMLDivElement;
    /**
     * Pushes the specified path to the browser's history and renders the corresponding route component.
     *
     * @param {string} path - The path to navigate to.
     * @return {Promise<undefined>}
     */
    navigate: (path: string) => Promise<undefined>;
    /**
     * Navigates back in the browser's history.
     */
    back(): Promise<void>;
    /**
     * Loads the route component corresponding to the specified path into the `<router-outlet>`
     * element.
     *
     * @param {string} path
     * @returns {Promise<boolean>} A promise that resolves to `true` if the route was loaded successfully, `false` otherwise.
     */
    updateDOMWithMatchingPath: (path: string) => Promise<boolean>;
    /**
     * Loads the matching routes for a path.
     * @param {string} path
     * @param {boolean} [navigate]
     * @param {Event} [_event]
     * Event that triggered the navigation.
     */
    loadPath: (path: string, navigate?: boolean | undefined, _event?: Event | undefined) => Promise<void>;
    isLoading: boolean;
}
export type ComponentOrComponentLoader = LazyRoute | (() => JSX.Template);
export type RouteRecords = import("./routeTree.js").RouteRecords<ComponentOrComponentLoader>;
export type RouteRecord = RouteRecords[number];
export type RouterOptions = {
    /**
     * The routes to be rendered by the router.
     */
    routes: RouteRecords;
    /**
     * Middleware to be executed before each route change.
     */
    middlewares?: RouterMiddleware[] | undefined;
    /**
     * The maximum number of redirects to allow before the router stops and throws an error.
     */
    maxRedirects?: number | undefined;
};
import { LazyRoute } from './lazy.js';
import { RouterMiddleware } from './middleware.js';
