import { setAttribute, setAttributeFromProps } from '../library/jsx.js';
import { generateChildNodes } from '../library/utils.js';
import { LazyRoute } from './lazy.js';
import { RouterMiddlewareResponse } from './middleware.js';
import { RouteTree } from './routeTree.js';

export * from './lazy.js';
export * from './routeTree.js';
export * from './middleware.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * @typedef {LazyRoute | (() => JSX.Template)} ComponentOrComponentLoader
 */

/**
 * @typedef {import('./routeTree.js').RouteRecords<ComponentOrComponentLoader>} RouteRecords
 */

/**
 * @template T
 * @typedef {import('./routeTree.js').MatchedRoute<T>} MatchedRoute
 */

/**
 * @typedef {RouteRecords[number]} RouteRecord
 */

/** @type {Router | null } */
let ROUTER_INSTANCE = null;

/**
 * @typedef RouterOptions
 * @property {RouteRecords} routes
 * The routes to be rendered by the router.
 * @property {import('./middleware.js').RouterMiddleware[]} [middlewares]
 * Middleware to be executed before each route change.
 * @property {number} [maxRedirects]
 * The maximum number of redirects to allow before the router stops and throws an error.
 */

export class Router {
  /** @private @type {string} */
  id;

  /** @private @type {HTMLElement[]} */
  links;

  /** @type {Map<string, string>} */
  params;

  /** @private RouteTree<ReturnType<import('../component.js').ElementConstructor>> */
  routeTree;

  /** @private RouterMiddleware[] */
  middlewares;

  /** @private @type {import('./middleware.js').RouteData | null} */
  currentPath;

  /** @private @type {number} */
  redirectStackCount;

  /** @private @type {number} */
  maxRedirects;

  /** @type {Promise<boolean>} */
  rendering;

  /**
   * Defines an anchor element and handles click events to navigate to the specified route.
   *
   * @type {(props?: JSX.JsxHtmlAnchorElement) => HTMLAnchorElement}
   * @param {JSX.JsxHtmlAnchorElement} props - The component props.
   * @returns {HTMLAnchorElement} The rendered `<router-link>` component.
   */
  Link;

  /**
   * Defines an element that serves as the router outlet, rendering the component
   * associated with the current route.
   *
   * This component is used internally by the `Router` class to handle route changes and
   * render the appropriate component.
   * @type {(props?: JSX.JsxHtmlDivElement) => HTMLDivElement}
   * @param {JSX.JsxHtmlDivElement} props
   */
  Outlet;

  /**
   * The global `window` object, which provides access to the browser's JavaScript API.
   *
   * @type {Window | undefined}
   */
  window;

  /** @param {RouterOptions} routeOptions */
  constructor(routeOptions) {
    this.id = crypto.randomUUID();
    this.routeTree = RouteTree.fromRouteRecords(routeOptions.routes);
    this.middlewares = routeOptions.middlewares ?? [];
    this.maxRedirects = routeOptions.maxRedirects ?? 50;
    this.currentPath = null;
    this.redirectStackCount = 0;
    this.rendering = Promise.resolve(false);
    this.links = [];
    this.params = new Map();

    this.Outlet = (props) => {
      if (!this.window) {
        throw new Error('Cannot create Outlet in undefined window.');
      }
      const outlet = this.window.document.createElement('div');

      if (props) {
        for (const [key, value] of Object.entries(props)) {
          // @ts-expect-error: The outlet is not of the type JsxElement.
          setAttributeFromProps(outlet, key, value);
        }
      }

      outlet.toggleAttribute('data-grenade-outlet', true);
      outlet.setAttribute('data-router-id', this.id);
      if (props) {
        outlet.replaceChildren(...generateChildNodes(props.children));
      }

      return outlet;
    };

    this.Link = (props) => {
      if (!this.window) {
        throw new Error('Cannot create Link in undefined window.');
      }
      const a = this.window?.document.createElement('a');
      if (!props || !('to' in props)) {
        console.error('missing to attribute for link component.');
      }

      if (props) {
        for (const [key, value] of Object.entries(props)) {
          // @ts-expect-error: a is not of type JsxElement.
          setAttribute(a, key, value);
        }
      }

      a.addEventListener('click', (event) => {
        event.preventDefault();
        this.navigate(a.href);
      });
      if (props) {
        a.replaceChildren(...generateChildNodes(props.children));
      }

      return a;
    };
    this.Link = this.Link.bind(this);
  }

  /**
   * Sets the window object for the router.
   * @param {Window} window - The window object to set.
   */
  setWindow(window) {
    this.window = window;
  }

  /**
   * Pushes the specified path to the browser's history and renders the corresponding route component.
   *
   * @param {string} path - The path to navigate to.
   * @return {Promise<void>}
   */
  navigate = async (path) => {
    if (path === '#') {
      return;
    }
    await this.loadPath(path, true);
  };

  /**
   * Navigates back in the browser's history.
   */
  back() {
    this.window?.history?.back();
  }

  /**
   * Loads the route component corresponding to the specified path into the `<router-outlet>`
   * element.
   *
   * @param {string} path
   * @returns {Promise<boolean>} A promise that resolves to `true` if the route was loaded successfully, `false` otherwise.
   */
  updateDOMWithMatchingPath = async (path) => {
    if (path === '#') {
      return false;
    }

    const matchResult = this.routeTree.match(path);

    matchResult.flattenTransientRoutes();
    this.params = matchResult.params;

    const targetMatch = matchResult.leaf();
    if (targetMatch !== null) {
      const sourcePath = this.currentPath
        ? {
            name: this.currentPath.name,
            params: this.currentPath.params,
            query: this.currentPath.query,
            fullPath: this.currentPath.fullPath,
          }
        : null;

      const targetPath = {
        name: targetMatch.name,
        params: matchResult.params,
        query: matchResult.searchQueryParams,
        fullPath: targetMatch.fullPath,
      };

      const middlewareArgs = {
        from: sourcePath,
        to: targetPath,
      };

      for (const middleware of this.middlewares) {
        const middlewareResponse = await middleware.callback(middlewareArgs);
        if (middlewareResponse instanceof RouterMiddlewareResponse) {
          if (middlewareResponse.type === 'redirect') {
            // Block deep redirects
            if (this.redirectStackCount > this.maxRedirects) {
              const message = `Your router redirected too many times (${this.maxRedirects}). This is probably due to a circular redirect in your route configuration.`;
              console.warn(message);
              return false;
            }

            // Ignore same-path redirects
            if (middlewareResponse.path === path) {
              continue;
            }

            this.redirectStackCount++;
            await this.navigate(middlewareResponse.path);
            return false;
          }
        }
      }
    }

    if (matchResult.subTree === null) {
      console.warn(`No route matches path: ${path}`);
      const outlet = this.window?.document.querySelector(
        'div[data-grenade-outlet]'
      );
      outlet?.removeAttribute('data-path');
      if (this.window) {
        outlet?.replaceChildren(emptyRoute(path, this.window));
      }
      return true;
    }

    /** @type {MatchedRoute<ComponentOrComponentLoader> | null} */
    let lastMatchedRoute = matchResult.subTree;
    /** @type {MatchedRoute<ComponentOrComponentLoader> | null} */
    let currentMatchedRoute = matchResult.subTree;
    let outletIndex = 0;
    /** @type {HTMLElement[]} */
    const outlets = Array.from(
      this.window?.document.querySelectorAll(
        `div[data-grenade-outlet][data-router-id="${this.id}"]`
      ) ?? []
    );

    while (currentMatchedRoute) {
      const outlet = outlets[outletIndex];

      if (outlet === undefined) {
        break;
      }

      if (outlet.hasAttribute('ct-static')) {
        outlet.removeAttribute('ct-static');
        outlet.removeAttribute('data-path');
      }

      if (outlet.dataset.path !== currentMatchedRoute.fullPath) {
        const matchedComponentOrLazyLoader = currentMatchedRoute.component;

        /** @type {ComponentOrComponentLoader} */
        let matchedComponent;

        if (
          matchedComponentOrLazyLoader === null ||
          matchedComponentOrLazyLoader === undefined
        ) {
          const outlet = outlets[outletIndex];
          if (currentMatchedRoute.child) {
            currentMatchedRoute = currentMatchedRoute.child;
            continue;
          }
          if (currentMatchedRoute.redirect) {
            await this.navigate(currentMatchedRoute.redirect);
            return false;
          }

          console.warn(`No component from route: ${path}`);
          outlet?.removeAttribute('data-path');
          if (this.window) {
            outlet?.replaceChildren(emptyRoute(path, this.window));
          }
          return true;
        }

        if (matchedComponentOrLazyLoader instanceof LazyRoute) {
          const component = await matchedComponentOrLazyLoader.importer();
          if ('default' in component) {
            matchedComponent = component.default;
          } else {
            matchedComponent = component;
          }
        } else {
          matchedComponent = matchedComponentOrLazyLoader;
        }

        outlet.dataset.path = currentMatchedRoute.fullPath;
        const renderedComponent = matchedComponent();

        // if the component performs a redirect, it would change the route
        // stored in the outlet's dataset, so we need to check before replacing.
        if (outlet.dataset.path === currentMatchedRoute.fullPath) {
          outlet.replaceChildren(...generateChildNodes(renderedComponent));
          if (currentMatchedRoute.title && this.window) {
            this.window.document.title = currentMatchedRoute.title;
          }
        } else {
          return false;
        }
      }

      outletIndex++;
      lastMatchedRoute = currentMatchedRoute;
      currentMatchedRoute = currentMatchedRoute.child;
    }

    for (const spareOutlet of Array.from(outlets).slice(outletIndex)) {
      spareOutlet.removeAttribute('data-route-name');
      spareOutlet.replaceChildren();
    }

    if (lastMatchedRoute.redirect && lastMatchedRoute.redirect !== path) {
      await this.navigate(lastMatchedRoute.redirect);
    }

    this.currentPath = {
      name: lastMatchedRoute.name,
      params: matchResult.params,
      query: matchResult.searchQueryParams,
      fullPath: lastMatchedRoute.fullPath,
    };

    if (this.redirectStackCount > 0) {
      this.redirectStackCount--;
    }
    return true;
  };

  /**
   * Loads the matching routes for a path.
   * @param {string} path
   * @param {boolean} [navigate]
   * @param {Event} [_event]
   * Event that triggered the navigation.
   */
  loadPath = async (path, navigate, _event) => {
    if (this.currentPath?.fullPath === path) {
      return;
    }

    const wasLoaded = await this.updateDOMWithMatchingPath(path);

    for (const link of this.links) {
      link.toggleAttribute(
        'active',
        Boolean(
          this.currentPath?.fullPath &&
            link.dataset.href?.startsWith(this.currentPath.fullPath)
        )
      );
    }

    if (navigate && wasLoaded) {
      this.window?.history?.pushState(null, '', path);
    }
  };

  /**
   * Attaches event listeners to the window object for handling navigation events.
   *
   * This method sets up listeners for the following events:
   * - popstate: Triggered when navigating through browser history
   * - hashchange: Triggered when the URL hash changes
   * - load: Triggered when the page finishes loading
   * - DOMContentLoaded: Triggered when the initial HTML document has been completely loaded and parsed
   *
   * Each listener manages the loading state and calls the loadPath method with appropriate parameters.
   */
  attachWindowListeners() {
    this.window?.addEventListener('popstate', async (event) => {
      if (!this.isLoading && this.window) {
        this.isLoading = true;
        await this.loadPath(this.window.location.pathname, false, event);
        this.isLoading = false;
      }
    });

    this.window?.addEventListener('hashchange', async (event) => {
      if (!this.isLoading && this.window) {
        this.isLoading = true;
        await this.loadPath(this.window.location.hash, false, event);
        this.isLoading = false;
      }
    });

    this.window?.addEventListener('load', async (event) => {
      if (!this.isLoading && this.window) {
        this.isLoading = true;
        await this.loadPath(this.window.location.pathname, false, event);
        this.isLoading = false;
      }
    });

    this.window?.addEventListener('DOMContentLoaded', async (event) => {
      if (!this.isLoading && this.window) {
        this.isLoading = true;
        await this.loadPath(this.window.location.pathname, false, event);
        this.isLoading = false;
      }
    });
  }

  isLoading = false;
}

/**
 * Creates a new web-based router instance with the provided route configurations.
 *
 * This function sets up the necessary event listeners for handling browser history events and initial page load, and assigns the created router instance to the global `ROUTER_INSTANCE` variable.
 *
 * @param {RouterOptions} routerOptions - The options object for configuring the router.
 * @returns {Router} The created router instance.
 */
export function createWebRouter(routerOptions) {
  const router = new Router(routerOptions);
  ROUTER_INSTANCE = router;

  return router;
}

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
export function useRouter() {
  if (!ROUTER_INSTANCE) {
    throw new Error('Router not initialized');
  }
  return ROUTER_INSTANCE;
}

/**
 * Wrapper function for defining route records.
 *
 * @param {RouteRecords} routes
 */
export function defineRoutes(routes) {
  return routes;
}

/**
 * Generates a DocumentFragment node with a text node indicating that the specified route path was not found.
 *
 * @param {string} path - The route path that was not found.
 * @param {Window} window - The window object.
 * @returns {DocumentFragment} A DocumentFragment node containing a text node with the "Route not found" message.
 */
function emptyRoute(path, window) {
  console.warn(`Route not found: ${path}`);
  const node = window.document.createDocumentFragment();
  node.appendChild(window.document.createTextNode(`Route not found: ${path}`));
  return node;
}
