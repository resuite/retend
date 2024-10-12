/**
 * Defines a new middleware function for the router.
 *
 * @param {MiddlewareCallback} callback - The callback function to be executed when the middleware is invoked.
 * @returns {RouterMiddleware} - A new `RouterMiddleware` instance with the provided callback function.
 */
export function defineRouterMiddleware(callback: MiddlewareCallback): RouterMiddleware;
/**
 * Redirects the user to the specified path.
 *
 * @param {string} path - The path to redirect the user to.
 * @returns {RouterMiddlewareResponse} - A new `RouterMiddlewareResponse` instance with the provided path and a 'redirect' type.
 */
export function redirect(path: string): RouterMiddlewareResponse;
/**
 * @typedef {(pathDetails: PathDetails) => Promise<void | RouterMiddlewareResponse> | void | RouterMiddlewareResponse} MiddlewareCallback
 */
/**
 * @typedef {Object} RouteMeta
 */
/**
 * @typedef {Object} RouteData
 * @property {string | null} name - The name of the route.
 * @property {Map<string, string>} params - The parameters of the route.
 * @property {URLSearchParams} query - The query parameters of the route.
 * @property {string} fullPath - The full path of the route.
 */
/**
 * @typedef {Object} PathDetails
 * @property {RouteData | null} from - The path from which the user is navigating.
 * @property {RouteData} to - The path to which the user is navigating.
 */
export class RouterMiddleware {
    /**
     * Constructs a new `RouterMiddleware` instance with the provided callback function.
     *
     * @param {MiddlewareCallback} callback - The callback function to be executed when the middleware is invoked.
     */
    constructor(callback: MiddlewareCallback);
    /** @type {MiddlewareCallback} */ callback: MiddlewareCallback;
}
export class RouterMiddlewareResponse {
    /**
     * Constructs a new `RouterMiddlewareResponse` instance with the provided path and type.
     *
     * @param {string} path - The path to redirect to.
     * @param {string} type - The type of response to send.
     */
    constructor(path: string, type: string);
    /** @type {string} */ path: string;
    /** @type {string} */ type: string;
}
export type MiddlewareCallback = (pathDetails: PathDetails) => Promise<void | RouterMiddlewareResponse> | void | RouterMiddlewareResponse;
export type RouteMeta = Object;
export type RouteData = {
    /**
     * - The name of the route.
     */
    name: string | null;
    /**
     * - The parameters of the route.
     */
    params: Map<string, string>;
    /**
     * - The query parameters of the route.
     */
    query: URLSearchParams;
    /**
     * - The full path of the route.
     */
    fullPath: string;
};
export type PathDetails = {
    /**
     * - The path from which the user is navigating.
     */
    from: RouteData | null;
    /**
     * - The path to which the user is navigating.
     */
    to: RouteData;
};
