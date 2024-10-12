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
  /** @type {MiddlewareCallback} */ callback;

  /**
   * Constructs a new `RouterMiddleware` instance with the provided callback function.
   *
   * @param {MiddlewareCallback} callback - The callback function to be executed when the middleware is invoked.
   */
  constructor(callback) {
    this.callback = callback;
  }
}

/**
 * Defines a new middleware function for the router.
 *
 * @param {MiddlewareCallback} callback - The callback function to be executed when the middleware is invoked.
 * @returns {RouterMiddleware} - A new `RouterMiddleware` instance with the provided callback function.
 */
export function defineRouterMiddleware(callback) {
  return new RouterMiddleware(callback);
}

export class RouterMiddlewareResponse {
  /** @type {string} */ path;
  /** @type {string} */ type;

  /**
   * Constructs a new `RouterMiddlewareResponse` instance with the provided path and type.
   *
   * @param {string} path - The path to redirect to.
   * @param {string} type - The type of response to send.
   */
  constructor(path, type) {
    this.path = path;
    this.type = type;
  }
}

/**
 * Redirects the user to the specified path.
 *
 * @param {string} path - The path to redirect the user to.
 * @returns {RouterMiddlewareResponse} - A new `RouterMiddlewareResponse` instance with the provided path and a 'redirect' type.
 */
export function redirect(path) {
  return new RouterMiddlewareResponse(path, 'redirect');
}
