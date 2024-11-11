import { setAttribute, setAttributeFromProps } from '../library/jsx.js';
import { generateChildNodes, FixedSizeMap } from '../library/utils.js';
import { LazyRoute } from './lazy.js';
import { RouterMiddlewareResponse } from './middleware.js';
import { MatchResult, RouteTree } from './routeTree.js';

export * from './lazy.js';
export * from './routeTree.js';
export * from './middleware.js';

const HISTORY_STORAGE_KEY = 'rhistory';

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

/**
 * @typedef {Object} ExtraLinkData
 */

/**
 * @typedef {Object} ExtraOutletData
 * @property {AnimationOptions} [animationOptions]
 * These define the animation properties to be applied to the children
 * of the outlet when the path changes.
 *
 * @property {boolean} [keepAlive]
 * As the outlet's children change, the outlet keeps track
 * of each route's nodes and reuses them when the path is rendered again.
 *
 * @property {number} [maxKeepAliveCount]
 * The maximum number of routes that can be kept alive by the outlet.
 * It defaults to 10.
 */

/**
 * @typedef {JSX.JsxHtmlAnchorElement & ExtraLinkData} RouterLinkProps
 */

/** @typedef {HTMLDivElement & {
 *  animationOptions?: AnimationOptions;
 *  keepAlive?: boolean;
 *  keepAliveCache?: FixedSizeMap<string, Node[]>;
 * }} RouterOutlet */

/** @typedef {JSX.JsxHtmlDivElement & ExtraOutletData} RouterOutletProps */

/** @type {Router | null } */
let ROUTER_INSTANCE = null;

/**
 * @typedef RouterOptions
 *
 * @property {RouteRecords} routes
 * The routes to be rendered by the router.
 *
 * @property {import('./middleware.js').RouterMiddleware[]} [middlewares]
 * Middleware to be executed before each route change.
 *
 * @property {number} [maxRedirects]
 * The maximum number of redirects to allow before the router stops and throws an error.
 *
 * @property {boolean} [stackMode]
 * If set to `true`, the router will treat the routes as a stack, and will automatically
 * go back or forward based on the route history.
 */

/**
 * @template T
 * @typedef {T | Promise<T>} PromiseOrNot
 */

/** @typedef {(nodes: Node[]) => PromiseOrNot<void | { className?: string, duration?: number }>} PreAnimationCallback */

/** @typedef {(nodes: Node[]) => PromiseOrNot<void>} PostAnimationCallback */

/**
 * @typedef AnimationOptions
 *
 * @property {string} [name]
 * The base name to apply to the animation elements.
 * When the animation is triggered, the keyframe name will be used to look for `{name}-enter` and `{name}-leave` CSS animation.
 * These keyframes can be combined in different ways to create complex transition effects.
 *
 * @property {number} [duration]
 * The duration of the animation in milliseconds.
 *
 * @property {PreAnimationCallback} [onBeforeEnter]
 * A function that is called before the animation starts.
 * It receives an array of nodes that are about to be animated in.
 * The function can return an object with different `name` and `duration` properties to customize the animation.
 *
 * @property {PreAnimationCallback} [onBeforeExit]
 * A function that is called before the animation ends.
 * It receives an array of nodes that are about to be animated out.
 * The function can return an object with `className` and `duration` properties to customize the animation.
 *
 * @property {PostAnimationCallback} [onAfterEnter]
 * A function that is called after the entering animation ends.
 *
 * @property {PostAnimationCallback} [onAfterExit]
 * A function that is called after the exit animation ends.
 */

/**
 * @typedef {'forwards' | 'backwards'} NavigationDirection
 */

export class Router {
  /**
   * The unique identifier for the router instance.
   * @type {string}
   */
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

  /** @private @type {boolean} */
  stackMode;

  /** @private @type {string[]} */
  routerHistory;

  /**
   * Defines an anchor element and handles click events to navigate to the specified route.
   *
   * @type {(props?: RouterLinkProps) => HTMLAnchorElement}
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
   * @type {(props?: RouterOutletProps) => HTMLDivElement}
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
    this.stackMode = routeOptions.stackMode ?? false;
    this.routerHistory = [];

    this.Outlet = (props) => {
      if (!this.window) {
        throw new Error('Cannot create Outlet in undefined window.');
      }

      /** @type {RouterOutlet} */
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
        if (props.animationOptions) {
          outlet.animationOptions = props.animationOptions;
        }
        if (props.keepAlive) {
          outlet.keepAlive = props.keepAlive;
          const maxKeepAliveCount = props.maxKeepAliveCount ?? 10;
          outlet.keepAliveCache = new FixedSizeMap(maxKeepAliveCount);
        }
        outlet.replaceChildren(...generateChildNodes(props.children));
      }

      return outlet;
    };

    this.Link = (props) => {
      if (!this.window) {
        throw new Error('Cannot create Link in undefined window.');
      }
      const a = this.window?.document.createElement('a');
      if (!props || !('href' in props)) {
        console.error('missing to attribute for link component.');
      }

      if (props) {
        for (const [key, value] of Object.entries(props)) {
          // @ts-expect-error: a is not of type JsxElement.
          setAttribute(a, key, value);
        }
      }

      a.addEventListener('click', (event) => {
        // Only navigate if the href is not a valid URL.
        // For valid URLs, the browser will handle the navigation.
        if (props?.href && !URL.canParse(props.href)) {
          event.preventDefault();
          this.navigate(props.href);
        }
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
   * @private
   * Pushes the specified path to the router's history.
   * @param {string} path - The path to push.
   */
  pushHistory(path) {
    this.routerHistory.push(path);
    this.persistHistory();
  }

  /**
   * @private
   * Removes the most recent path from the router's history and persists the updated history.
   */
  popHistory() {
    this.routerHistory.pop();
    this.persistHistory();
  }

  /**
   * @private
   * Persists the current router history to the browser's session storage.
   * This allows the history to be restored across page reloads or browser sessions.
   */
  persistHistory() {
    if (this.window?.sessionStorage) {
      this.window.sessionStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(this.routerHistory)
      );
    }
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
   * @private
   * @param {string} path
   * @param {MatchResult<ComponentOrComponentLoader>} matchResult
   * @param {MatchedRoute<ComponentOrComponentLoader>} targetMatch
   * @param {import('./middleware.js').RouteData | null} [workingPath]
   * @param {'navigate' | 'preload'} mode
   * @returns {string | undefined} The final path to navigate to or preload.
   */
  runMiddlewares(
    path,
    matchResult,
    targetMatch,
    workingPath,
    mode = 'navigate'
  ) {
    const currentPath = workingPath ?? this.currentPath;
    const sourcePath = currentPath
      ? {
          name: currentPath.name,
          params: currentPath.params,
          query: currentPath.query,
          fullPath: currentPath.fullPath,
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
      const middlewareResponse = middleware.callback(middlewareArgs);
      if (middlewareResponse instanceof RouterMiddlewareResponse) {
        if (middlewareResponse.type === 'redirect') {
          // Block deep redirects
          if (this.redirectStackCount > this.maxRedirects) {
            if (mode === 'navigate') {
              const message = `Your router redirected too many times (${this.maxRedirects}). This is probably due to a circular redirect in your route configuration.`;
              console.warn(message);
            }
            return;
          }
          // Ignore same-path redirects
          if (middlewareResponse.path === path) {
            continue;
          }
          this.redirectStackCount++;
          return this.runMiddlewares(
            middlewareResponse.path,
            matchResult,
            targetMatch,
            workingPath,
            mode
          );
        }
      }
    }
    return path;
  }

  /**
   * Loads the route component corresponding to the specified path into the router outlet.
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
      const finalPath = this.runMiddlewares(
        path,
        matchResult,
        targetMatch,
        this.currentPath,
        'navigate'
      );
      if (finalPath !== path) {
        if (finalPath !== undefined) {
          await this.navigate(finalPath);
        }
        return false;
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
    /** @type {RouterOutlet[]} */
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
          if (currentMatchedRoute.title && this.window) {
            this.window.document.title = currentMatchedRoute.title;
          }
          if (currentMatchedRoute.child) {
            currentMatchedRoute = currentMatchedRoute.child;
            if (currentMatchedRoute.title && this.window) {
              this.window.document.title = currentMatchedRoute.title;
            }
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

        /** @type {NavigationDirection} */
        let animationDirection = 'forwards';
        if (this.stackMode) {
          const currentPath = this.routerHistory.at(-1);
          const previousPath = this.routerHistory.at(-2);

          if (previousPath === currentMatchedRoute.fullPath) {
            this.popHistory();
            animationDirection = 'backwards';
          } else if (currentPath !== currentMatchedRoute.fullPath) {
            // If the path is still constant, nothing to do.
            // Otherwise, we need to push the new path to the history.
            this.pushHistory(currentMatchedRoute.fullPath);
          }
          console.log('Stack Mode', this.routerHistory, animationDirection);
        }

        outlet.dataset.path = currentMatchedRoute.fullPath;
        const renderedComponent =
          outlet.keepAliveCache?.get(path) ?? matchedComponent();

        // if the component performs a redirect, it would change the route
        // stored in the outlet's dataset, so we need to check before replacing.
        if (outlet.dataset.path === currentMatchedRoute.fullPath) {
          // if the outlet is keep alive, we need to cache the current nodes
          const currentNodes = Array.from(outlet.childNodes);
          if (outlet.keepAlive && this.currentPath) {
            outlet.keepAliveCache?.set(this.currentPath.fullPath, currentNodes);
          }
          const newRoute = generateChildNodes(renderedComponent);
          outlet.replaceChildren(...newRoute);

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
   * @param {string} rawPath
   * @param {boolean} [navigate]
   * @param {Event} [_event]
   * Event that triggered the navigation.
   */
  loadPath = async (rawPath, navigate, _event) => {
    const [pathRoot, pathQuery] = rawPath.split('?');
    // Ensures that .html is removed from the path.
    const path =
      (pathRoot.endsWith('.html') ? pathRoot.slice(0, -5) : pathRoot) +
      (pathQuery ?? '');
    if (this.currentPath?.fullPath === path) {
      return;
    }

    const oldRouterHistoryLength = this.routerHistory.length;
    const wasLoaded = await this.updateDOMWithMatchingPath(path);
    const newRouterHistoryLength = this.routerHistory.length;

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
      // If the new history length is less than the old history length
      // in stack mode, it means that the user navigated backwards in the history.
      if (this.stackMode && newRouterHistoryLength < oldRouterHistoryLength) {
        this.window?.history?.back();
        return;
      }

      // If the new history length is equal to the old history length,
      // in stack mode, it means no navigation occurred.
      if (this.stackMode && newRouterHistoryLength === oldRouterHistoryLength) {
        return;
      }

      // otherwise, we can assume that the user navigated forward in the history.
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
   *
   * The router also retrieves any saved history from the browser's session storage
   * and merges it with the current history.
   */
  attachWindowListeners() {
    const savedSessionHistory =
      this.window?.sessionStorage?.getItem(HISTORY_STORAGE_KEY);
    if (savedSessionHistory) {
      try {
        // In cases where entries have already been added to the history
        // before attaching the window listeners,
        // we need to concat them with the saved history.
        const savedHistoryArray = JSON.parse(savedSessionHistory);
        if (Array.isArray(savedHistoryArray)) {
          // dedupe last entry
          if (
            savedHistoryArray.length > 0 &&
            savedHistoryArray.at(-1) === this.routerHistory[0]
          ) {
            savedHistoryArray.pop();
          }
          this.routerHistory = savedHistoryArray.concat(this.routerHistory);
        }
      } catch (error) {
        console.error('Error parsing session history:', error);
      }
    }
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
