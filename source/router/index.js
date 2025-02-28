import { Cell, SourceCell } from '@adbl/cells';
import { setAttributeFromProps, appendChild } from '../library/jsx.js';
import {
  generateChildNodes,
  FixedSizeMap,
  getMostCurrentFunction,
} from '../library/utils.js';
import { LazyRoute } from './lazy.js';
import { RouterMiddlewareResponse } from './middleware.js';
import { MatchResult, RouteTree } from './routeTree.js';
import { linkNodesToComponent } from '../render/index.js';
import { matchContext, Modes, isVNode } from '../library/context.js';

export * from './lazy.js';
export * from './routeTree.js';
export * from './middleware.js';

const HISTORY_STORAGE_KEY = 'rhistory';
const PARAM_REGEX = /:(\w+)/g;
const RELAY_ID_REGEX =
  /^([a-zA-Z_][a-zA-Z0-9_-]*|\\[0-9A-Fa-f]{1,6}(\r\n|[ \n\r\t\f])?)/;

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */
// @ts-ignore: Deno has issues with @import tags.
/** @import * as SSR from '../ssr/v-dom.js' */
// @ts-ignore: Deno has issues with @import tags.
/** @import * as Context from '../library/context.js' */

/**
 * @typedef {LazyRoute | ((() => JSX.Template) & RouteLevelFunctionData)} ComponentOrComponentLoader
 */

/**
 * @typedef {'routechange'} RouterEventTypes
 */

/**
 * @typedef RouteChangeEventDetail
 *
 * @property {string | undefined} from
 * The path of the route that was leaving.
 *
 * @property {string} to
 * The path of the route that was entering.
 */

/**
 * @extends {CustomEvent<RouteChangeEventDetail>}
 */
export class RouteChangeEvent extends CustomEvent {
  /**
   * @param {RouteChangeEventDetail} eventInitDict
   */
  constructor(eventInitDict) {
    super('routechange', {
      cancelable: true,
      bubbles: false,
      detail: eventInitDict,
    });
  }
}

/**
 * @typedef {{
 *  'routechange': (this: Router, event: RouteChangeEvent) => void;
 * }} RouterEventHandlerMap
 */

/**
 * @typedef RouteLevelFunctionData
 *
 * @property {boolean} [__routeLevelFunction]
 *
 * @property {WeakRef<RouterOutlet>} [__renderedOutlet]
 *
 * @property {string} [__renderedPath]
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

/** @typedef {HTMLElement | SVGAElement | MathMLElement} DomElement */

/**
 * @typedef {Object} ExtraOutletData
 *
 * @property {boolean} [keepAlive]
 * As the outlet's children change, the outlet keeps track
 * of each route's nodes and reuses them when the path is rendered again.
 *
 * @property {number} [maxKeepAliveCount]
 * The maximum number of routes that can be kept alive by the outlet.
 * It defaults to 10.
 */

/** @typedef {(nodes: JSX.Template) => PromiseOrNot<void>} RelayCallback */

/**
 * @template SourceProps
 * @template {(props: SourceProps) => JSX.Template} [SourceFn=(props: SourceProps) => JSX.Template]
 * @typedef RouterRelayProps
 *
 * @property {string} id
 * The name to use in identifying the relay.
 * This will be used to match relays across route changes.
 *
 * @property {Cell<HTMLElement | null>} [ref]
 * A cell that can be used to reference the relay element.
 *
 * @property {RelayCallback} [onNodesReceived]
 * A callback function that is called when the router matches and
 * receives nodes into the relay from a previous route.
 *
 * @property {RelayCallback} [onNodesSent]
 * A callback function that is called when the router matches and
 * sends nodes from this relay to a new route.
 *
 * @property {SourceFn} source
 * In cases where there is no previous route, or no nodes have been received,
 * this function is called to provide the initial value of the relay.
 * The nodes are still passed to the `onNodesReceived` callback.
 *
 * @property {SourceProps} [sourceProps]
 * The props to pass to the render function, if any are necessary.
 */

/**
 * @typedef RouteSnapShot
 *
 * @property {SSR.VDocumentFragment | DocumentFragment} fragment
 * The nodes that were in the outlet when the snapshot was taken.
 *
 * @property {[number, number]} outletScroll
 * The `(x, y)` scroll positions of the outlet when the snapshot was taken.
 *
 * @property {[number, number]} windowScroll
 * The `(x, y)` scroll positions of the window when the snapshot was taken.
 */

/**
 * @typedef {JSX.IntrinsicElements['a'] & ExtraLinkData} RouterLinkProps
 */

/**
 * @typedef {Object} NavigationOptions
 *
 * @property {boolean} [replace]
 * Whether to replace the current history entry with the new path.
 */

/**
 * @typedef {Context.HTMLElementLike & {
 *  __keepAlive?: boolean;
 *  __keepAliveCache?: FixedSizeMap<string, RouteSnapShot>;
 * }} RouterOutlet
 */

/**
 * @template [SourceProps=object]
 * @template {(props: SourceProps) => JSX.Template} [SourceFn=(props: SourceProps) => JSX.Template]
 * @typedef {Context.HTMLElementLike & {
 *  __name?: string;
 *  __props: SourceProps;
 *  __render?: SourceFn;
 *  __onNodesReceived?: (nodes: JSX.Template) => void;
 *  __onNodesSent?: (nodes: JSX.Template) => void;
 * }} RouterRelay
 */

/** @typedef {JSX.IntrinsicElements['div'] & ExtraOutletData} RouterOutletProps */

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
 *
 * @property {boolean} [useViewTransitions]
 * If set to `true`, the router will use browser view transitions when navigating between routes.
 *
 */

/**
 * @template T
 * @typedef {T | Promise<T>} PromiseOrNot
 */

/**
 * @typedef {'forwards' | 'backwards'} NavigationDirection
 */

/**
 * @typedef {NavigationOptions & { href: string }} RouterNavigationEventDetail
 */

/** @extends {CustomEvent<RouterNavigationEventDetail>} */
export class RouterNavigationEvent extends CustomEvent {}

/**
 * A client-side router for building dynamic web applications.
 *
 * The router manages navigation between different views in your application,
 * handling URL changes and rendering the appropriate components.
 *
 * @example
 * Basic Usage
 * ```tsx
 * // Create and configure the router
 * const router = createWebRouter({
 *   routes: [
 *     { path: '/', component: Home },
 *     { path: '/about', component: About }
 *   ]
 * })
 *
 * // Add the router outlet where components will render
 * <router.Outlet />
 *
 * // Create links for navigation
 * <router.Link href="/about">About</router.Link>
 * ```
 *
 * The router provides additional features like caching and
 * advanced navigation patterns that can be added as your needs grow.
 */
export class Router extends EventTarget {
  /** @type {Map<string, string>} */
  params;

  /** @private @type {RouteTree<ComponentOrComponentLoader>} */
  routeTree;

  /** @private @type {import('./middleware.js').RouterMiddleware[]} */
  middlewares;

  /** @private @type {SourceCell<import('./middleware.js').RouteData>} */
  currentPath;

  /** @private @type {number} */
  redirectStackCount;

  /** @private @type {number} */
  maxRedirects;

  /** @private @type {boolean} */
  stackMode;

  /** @private @type {string[]} */
  history;

  /** @type {boolean} */
  useViewTransitions;

  /** @private @type {CSSStyleSheet | undefined} */
  sheet;

  /**
   * The global `window` object, which provides access to the browser's JavaScript API.
   * @type {Context.WindowLike | undefined}
   */
  window;

  /** @param {RouterOptions} routeOptions */
  constructor(routeOptions) {
    super();
    this.routeTree = RouteTree.fromRouteRecords(routeOptions.routes);
    this.middlewares = routeOptions.middlewares ?? [];
    this.maxRedirects = routeOptions.maxRedirects ?? 50;
    this.currentPath = Cell.source(
      /** @type {import('./middleware.js').RouteData} */ ({
        name: null,
        path: '',
        query: new URLSearchParams(),
        fullPath: '',
        params: new Map(),
      })
    );

    this.redirectStackCount = 0;
    this.params = new Map();
    this.stackMode = routeOptions.stackMode ?? false;
    this.useViewTransitions = routeOptions.useViewTransitions ?? false;
    this.history = [];
    this.sheet = undefined;
    this.Link = this.Link.bind(this);
    this.Outlet = this.Outlet.bind(this);
    this.Relay = this.Relay.bind(this);
    this.getCurrentRoute = this.getCurrentRoute.bind(this);
    this.replace = this.replace.bind(this);
    this.back = this.back.bind(this);
    this.navigate = this.navigate.bind(this);
  }

  /**
   * Defines an anchor element and handles click events to navigate to the specified route.
   *
   * @type {(props?: RouterLinkProps) => JSX.Template}
   * @param {RouterLinkProps} [props] - The component props.
   * @returns {JSX.Template} The rendered anchor element.
   *
   * @example
   * ```tsx
   * // Basic navigation
   * <router.Link href="/about">About</router.Link>
   *
   * // With additional attributes
   * <router.Link href="/contact" class="button">
   *   Contact Us
   * </router.Link>
   * ```
   */
  Link(props) {
    if (!this.window) {
      throw new Error('Cannot create Link in undefined window.');
    }
    const a = this.window?.document.createElement('a');
    if (!props || !('href' in props)) {
      console.error('missing to attribute for link component.');
    } else {
      setAttributeFromProps(a, 'href', props.href);
    }
    if (props && 'active' in props) {
      console.error('active attribute is reserved for router.');
    }
    /** @type {(route: ReturnType<typeof this.getCurrentRoute>['value']) => void} */
    const callback = ({ fullPath }) => {
      const href = a.getAttribute('href');
      const isActive = Boolean(fullPath && href && fullPath.startsWith(href));
      a.toggleAttribute('active', isActive);
    };
    this.currentPath.runAndListen(callback, { weak: true });
    // Store the callback to prevent it from being garbage collected.
    // @ts-ignore
    a.__routeChangedCallback = callback;

    if (props) {
      const { children, replace, ...rest } = props;
      for (const [key, value] of Object.entries(rest)) {
        setAttributeFromProps(a, key, value);
      }
      appendChild(a, a.tagName.toLowerCase(), props.children);
    }

    /**
     * @param {Event} event
     */
    const handleNavigate = async (event) => {
      if (this.isLoading) {
        event.preventDefault();
        return;
      }
      // Only navigate if the href is not a valid URL.
      // For valid URLs, the browser will handle the navigation.
      const href = a.getAttribute('href');
      if (href && !URL.canParse(href)) {
        const replace = props?.replace;
        event.preventDefault();
        const beforeEvent = new RouterNavigationEvent('beforenavigate', {
          detail: { href, replace },
          cancelable: true,
        });
        a.dispatchEvent(beforeEvent);
        if (beforeEvent.defaultPrevented) return;

        await this.navigate(href, { replace });

        const afterEvent = new RouterNavigationEvent('afternavigate', {
          detail: { href, replace },
        });
        a.dispatchEvent(afterEvent);
      }
    };

    a.addEventListener('click', handleNavigate);

    return a;
  }

  /**
   * Defines an element that serves as the router outlet, rendering the component
   * associated with the current route.
   *
   * This component is used internally by the {@link Router} class to handle route changes and
   * render the appropriate component.
   * @type {(props?: RouterOutletProps) => JSX.Template}
   * @param {RouterOutletProps} [props]
   * @returns {JSX.Template} The rendered custom element that serves as the router outlet.
   *
   * @example
   * ```tsx
   * // Basic usage
   * <router.Outlet />
   * ```
   */
  Outlet(props) {
    if (!this.window) {
      throw new Error('Cannot create Outlet in undefined window.');
    }

    /** @type {RouterOutlet } */
    const outlet = this.window.document.createElement(
      'unfinished-router-outlet'
    );

    if (props) {
      const { keepAlive, maxKeepAliveCount, children, ...rest } = props;
      for (const [key, value] of Object.entries(rest)) {
        setAttributeFromProps(outlet, key, value);
      }
      appendChild(outlet, outlet.tagName.toLowerCase(), props.children);
    }

    if (props) {
      if (props.keepAlive) {
        outlet.__keepAlive = props.keepAlive;
        const maxKeepAliveCount = props.maxKeepAliveCount ?? 10;
        outlet.__keepAliveCache = new FixedSizeMap(maxKeepAliveCount);
      }
    }

    return outlet;
  }

  /**
   * A component for persisting and reusing state across routes.
   *
   * The Relay component ensures that shared state and DOM elements remain consistent
   * across route changes by linking relay instances using unique identifiers.
   * Animations and transitions are not supported, but they can be added using the View Transitions API.
   *
   * @type {<Props, SourceFn extends (props: Props) => JSX.Template>(props: RouterRelayProps<Props, SourceFn>) => JSX.Template}
   * @returns {JSX.Template} A container element for managing and persisting state across routes.
   *
   * @example
   * ```tsx
   * // Base component
   * function UserForm(props) {
   *   return (
   *     <form>
   *       <label>
   *         Name:
   *         <input
   *           type="text"
   *           value={props.name}
   *           onInput={(e) => props.setName((e.target as HTMLInputElement).value)}
   *         />
   *       </label>
   *     </form>
   *   );
   * }
   *
   * // Relay component
   * function UserFormRelay() {
   *   const router = useRouter();
   *   return (
   *     <router.Relay
   *       id="user-form"
   *       source={UserForm}
   *       sourceProps={{ name: 'John Doe', setName: (value) => console.log(value) }}
   *     />
   *   );
   * }
   *
   * // Usage across routes:
   * // page1/index.tsx
   * <UserFormRelay />
   *
   * // page2/index.tsx
   * <UserFormRelay />
   * ```
   */
  Relay(props) {
    if (!this.window) {
      throw new Error('Cannot create Relay in undefined window.');
    }

    const relay =
      /** @type {RouterRelay<NonNullable<NonNullable<(typeof props)>['sourceProps']>>} */ (
        this.window.document.createElement('unfinished-router-relay')
      );

    if (!props) {
      return relay;
    }

    if (props.id && RELAY_ID_REGEX.test(props.id)) {
      relay.setAttribute('data-x-relay-name', props.id);
      relay.__name = props.id;
    } else {
      console.warn('Invalid relay id.');
    }

    if (props.onNodesReceived) {
      relay.__onNodesReceived = props.onNodesReceived;
    }

    if (props.sourceProps) {
      relay.__props = props.sourceProps;
    }

    if (props.source) {
      relay.__render = props.source;

      if (!this.isLoading) {
        // @ts-ignore: The render type is generic.
        if (relay.__render) {
          relay.__render = getMostCurrentFunction(relay.__render);
        }
        const nodes = generateChildNodes(relay.__render?.(relay.__props));
        linkNodesToComponent(nodes, relay.__render, relay.__props);
        appendChild(relay, relay.tagName.toLowerCase(), nodes);
        relay.__onNodesReceived?.(nodes);
      }
    }

    if (props.onNodesSent) {
      relay.__onNodesSent = props.onNodesSent;
    }

    return relay;
  }

  /**
   * @private
   * Defines the web components used by the router.
   * This method creates and registers the 'unfinished-router-outlet' and 'unfinished-router-relay' custom elements,
   * and applies a CSS style sheet to set their display property to 'contents'.
   * The method returns the created CSS style sheet.
   */
  defineWebComponents() {
    if (this.sheet) {
      return this.sheet;
    }

    if (!this.window) return;
    if (matchContext(this.window, Modes.Static)) return;
    if (!this.window.document.adoptedStyleSheets) return;

    this.sheet = new CSSStyleSheet();
    this.sheet.replaceSync(
      `
unfinished-router-outlet, unfinished-router-relay, unfinished-teleport {
  display: contents;
}
`
    );
    this.window.document.adoptedStyleSheets.push(this.sheet);

    if (!this.window.customElements.get('unfinished-router-outlet')) {
      this.window.customElements.define(
        'unfinished-router-outlet',
        class extends HTMLElement {}
      );
    }

    if (!this.window.customElements.get('unfinished-router-relay')) {
      this.window.customElements.define(
        'unfinished-router-relay',
        class extends HTMLElement {}
      );
    }

    return this.sheet;
  }

  /**
   * Sets the window object for the router.
   * @param {Context.WindowLike} window - The window object to set.
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
    this.history.push(path);
    this.persistHistory();
  }

  /**
   * @private
   * Removes the most recent path from the router's history and persists the updated history.
   */
  popHistory() {
    this.history.pop();
    this.persistHistory();
  }

  /**
   * @private
   * Persists the current router history to the browser's session storage.
   * This allows the history to be restored across page reloads or browser sessions.
   */
  persistHistory() {
    if (this.window && 'sessionStorage' in this.window) {
      this.window.sessionStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(this.history)
      );
    }
  }

  /**
   * Updates the browser history and renders the corresponding route component.
   *
   * @example
   * ```tsx
   * // Basic navigation
   * router.navigate('/about')
   *
   * // Navigate with query parameters
   * router.navigate('/search?query=test')
   *
   * // Navigate to dynamic routes
   * router.navigate(`/photos/${photoId}`)
   * ```
   *
   * The navigation process:
   * 1. Updates the URL without page reload
   * 2. Matches the new path to a route
   * 3. Runs configured middleware
   * 4. Updates the browser history
   *
   * @param {string} path - The path to navigate to
   * @param {NavigationOptions} [options]
   * @return {Promise<void>} A promise that resolves when the navigation is complete.
   */
  navigate = async (path, options) => {
    if (path === '#') return;
    this.isLoading = true;
    await this.loadPath(path, true, undefined, options?.replace, false);
    this.isLoading = false;
  };

  /**
   * Replaces the current browser history with a new path, triggering a navigation.
   *
   * This method behaves similarly to `navigate`, but instead of pushing a new entry
   * to the browser history, it replaces the current entry. This means the user
   * won't be able to navigate back to the previous path using the browser's back
   * button.
   *
   * The navigation process is the same as in `navigate`:
   * 1. Updates the URL without page reload
   * 2. Matches the new path to a route
   * 3. Runs configured middleware
   * 4. Updates the browser history
   *
   * @example
   *
   * // Basic usage
   * router.replace('/new-path')
   *
   * // Replace with query parameters
   * router.replace('/search?query=test')
   *
   * // Replace with dynamic route
   * router.replace(`/user/${userId}`)
   *
   *
   * @param {string} path - The path to navigate to
   * @return {Promise<void>} A promise that resolves when the navigation is complete.
   */
  replace = async (path) => {
    if (path === '#') return;
    this.isLoading = true;
    await this.loadPath(path, true, undefined, true);
    this.isLoading = false;
  };

  /**
   * Navigates back in the browser's history.
   *
   * @example
   * ```tsx
   * // Basic usage
   * router.back()
   *
   * // Common use case in a component
   * <button onClick={() => router.back()}>
   *   Go Back
   * </button>
   * ```
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
    const currentPath = workingPath ?? this.currentPath.value;
    const sourcePath = currentPath
      ? {
          name: currentPath.name,
          params: currentPath.params,
          query: currentPath.query,
          path: currentPath.path,
          fullPath: currentPath.fullPath,
        }
      : null;
    const targetPath = {
      name: targetMatch.name,
      params: matchResult.params,
      query: matchResult.searchQueryParams,
      path: targetMatch.path,
      fullPath: path,
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
   * @private
   * Loads the route component corresponding to the specified path into the router outlet.
   *
   * @param {string} path
   * @param {boolean | undefined} replace
   * @param {string[]} viewTransitionTypesArray
   * @returns {Promise<boolean>} A promise that resolves to `true` if the route was loaded successfully, `false` otherwise.
   */
  updateDOMWithMatchingPath = async (
    path,
    replace,
    viewTransitionTypesArray
  ) => {
    if (path === '#') return false;

    const currentPath = this.currentPath.value.path
      ? constructURL(this.currentPath.value.path, {
          params: this.currentPath.value.params,
          searchQueryParams: this.currentPath.value.query,
        })
      : undefined;
    const nextPath = path;
    const event = new RouteChangeEvent({ to: nextPath, from: currentPath });
    this.dispatchEvent(event);
    if (event.defaultPrevented) return false;

    const matchResult = this.routeTree.match(path);
    matchResult.flattenTransientRoutes();
    this.params = matchResult.params;

    const targetMatch = matchResult.leaf();
    if (targetMatch !== null) {
      const finalPath = this.runMiddlewares(
        path,
        matchResult,
        targetMatch,
        this.currentPath.value,
        'navigate'
      );
      if (finalPath !== path) {
        if (finalPath !== undefined) {
          await this.navigate(finalPath, { replace });
        }
        return false;
      }
    }

    if (matchResult.subTree === null) {
      console.warn(`No route matches path: ${path}`);
      const outlet = findOutletNode(this.window?.document);
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
    /** @type {RouterOutlet | null} */ //@ts-ignore
    let outlet = findOutletNode(this.window?.document);

    if (!outlet) return false;

    while (currentMatchedRoute) {
      if (!outlet) break;

      if (outlet.getAttribute('data-path') === currentMatchedRoute.path) {
        lastMatchedRoute = currentMatchedRoute;
        currentMatchedRoute = currentMatchedRoute.child;
        outlet = findOutletNode(outlet);

        // If only the search params changed, then the last outlet
        // should trigger a route change.
        if (!outlet || !currentMatchedRoute) {
          const fullPath = constructURL(lastMatchedRoute.path, matchResult);
          if (this.currentPath.value.fullPath !== fullPath) {
            this.currentPath.value = {
              name: lastMatchedRoute.name,
              path: lastMatchedRoute.path,
              params: matchResult.params,
              query: matchResult.searchQueryParams,
              fullPath,
            };
          }

          // There is no feasible way to determine the final navigation direction
          // for view transitions, without already triggering a view transition.
          // Mind bending nonsense.
          const navigationDirection = this.chooseNavigationDirection(
            fullPath,
            replace
          );
          viewTransitionTypesArray[0] = navigationDirection;
        }
        continue;
      }

      const matchedComponentOrLazyLoader = currentMatchedRoute.component;

      /** @type {ComponentOrComponentLoader} */
      let matchedComponent;

      if (
        matchedComponentOrLazyLoader === null ||
        matchedComponentOrLazyLoader === undefined
      ) {
        if (currentMatchedRoute.child) {
          currentMatchedRoute = currentMatchedRoute.child;
          continue;
        }
        if (currentMatchedRoute.redirect) {
          await this.navigate(currentMatchedRoute.redirect, { replace });
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

      const fullPathWithSearchAndHash = constructURL(
        currentMatchedRoute.path,
        matchResult
      );

      // The current path must react before the page loads.
      const oldPath = this.currentPath.value.fullPath;
      if (this.currentPath.value.fullPath !== fullPathWithSearchAndHash) {
        this.currentPath.value = {
          name: currentMatchedRoute.name,
          path: currentMatchedRoute.path,
          params: matchResult.params,
          query: matchResult.searchQueryParams,
          fullPath: fullPathWithSearchAndHash,
        };
      }

      outlet.setAttribute('data-path', currentMatchedRoute.path);

      /** @type {JSX.Template} */
      let renderedComponent;
      const snapshot = outlet.__keepAliveCache?.get(path);
      if (snapshot) {
        renderedComponent = [...snapshot.fragment.childNodes];
      } else {
        renderedComponent = await matchedComponent();
      }

      matchedComponent.__routeLevelFunction = true;
      matchedComponent.__renderedOutlet = new WeakRef(outlet);
      matchedComponent.__renderedPath = fullPathWithSearchAndHash;

      // if the component performs a redirect internally, it would change the route
      // stored in the outlet's dataset, so we need to check before replacing.
      if (outlet.getAttribute('data-path') !== currentMatchedRoute.path) {
        return false;
      }

      // There is no feasible way to determine the final navigation direction
      // for view transitions, without already triggering a view transition.
      // Mind bending nonsense.
      const navigationDirection = this.chooseNavigationDirection(
        fullPathWithSearchAndHash,
        replace
      );
      viewTransitionTypesArray[0] = navigationDirection;
      if (currentMatchedRoute.transitionType) {
        viewTransitionTypesArray[1] = currentMatchedRoute.transitionType;
      }

      // if the outlet is keep alive, we need to cache the current nodes
      if (outlet.__keepAlive && oldPath && this.window) {
        // Caching as a fragment instead of an array of nodes
        // makes it possible for the cached nodes to still be reactive
        // in a For, Switch or If block, since they are still in a DOM tree.
        const fragment = this.window.document.createDocumentFragment();
        const contents = /** @type {Context.AsNode[]} */ (outlet.childNodes);
        fragment.append(...contents);
        recordScrollPositions(fragment);
        outlet.__keepAliveCache?.set(oldPath, {
          fragment,
          outletScroll: [outlet.scrollLeft, outlet.scrollTop],
          windowScroll: [this.window?.scrollX ?? 0, this.window?.scrollY ?? 0],
        });
      }

      const newNodes = generateChildNodes(renderedComponent);
      linkNodesToComponent(newNodes, matchedComponent, undefined);

      const newNodesFragment = await this.handleRelays(outlet, newNodes);
      if (newNodesFragment) {
        renderRouteIntoOutlet(outlet, newNodesFragment, this.window);
      }

      lastMatchedRoute = currentMatchedRoute;
      currentMatchedRoute = currentMatchedRoute.child;
      const nextOutlet = /** @type {RouterOutlet} */ (findOutletNode(outlet));
      outlet = nextOutlet;
    }

    if (lastMatchedRoute.redirect && lastMatchedRoute.redirect !== path) {
      await this.navigate(lastMatchedRoute.redirect, { replace });
    }

    if (this.redirectStackCount > 0) {
      this.redirectStackCount--;
    }

    if (this.window && (currentMatchedRoute?.title || lastMatchedRoute.title)) {
      const title = currentMatchedRoute?.title || lastMatchedRoute.title || '';
      this.window.document.title = title;
    }

    return true;
  };

  /**
   * @template {RouterEventTypes} EventType
   * @param {EventType} type
   * @param {RouterEventHandlerMap[EventType] | null} listener
   * @param {EventListenerOptions} [options]
   */
  //@ts-ignore: Typescript event listener types are inadequate.
  addEventListener(type, listener, options) {
    super.addEventListener(type, /**@type {any} */ (listener), options);
  }

  /**
   * @template {RouterEventTypes} EventType
   * @param {EventType} type
   * @param {RouterEventHandlerMap[EventType]} listener
   * @param {EventListenerOptions} [options]
   */
  //@ts-ignore: Typescript event listener types are inadequate.
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, /**@type {any} */ (listener), options);
  }

  getRouterPathHistory() {
    return [...this.history];
  }

  /**
   * @private
   * @param {string} targetPath
   * @param {boolean} [replace]
   * @returns {NavigationDirection}
   */
  chooseNavigationDirection = (targetPath, replace) => {
    /** @type {NavigationDirection} */
    let navigationDirection = 'forwards';
    const currentPath = this.history.at(-1);
    if (!this.stackMode || currentPath === targetPath) {
      return navigationDirection;
    }

    if (replace) {
      this.history.pop();
      this.history.push(targetPath);
      return navigationDirection;
    }

    const previousIndex = this.history.findLastIndex(
      (path) => path === targetPath
    );
    if (previousIndex !== -1) {
      navigationDirection = 'backwards';
      while (this.history.length > previousIndex + 1) {
        this.popHistory();
      }
    } else {
      // If the path is not found, we need to push the new path to the history.
      this.pushHistory(targetPath);
    }

    return navigationDirection;
  };

  /**
   * Returns a reactive cell that contains the current route data.
   */
  getCurrentRoute() {
    return Cell.derived(() => {
      return { ...this.currentPath.value };
    });
  }

  /**
   * @private
   * Handles relaying for DOM elements during route changes.
   * @param {RouterOutlet} oldNodesFragment - The DOM fragment containing the old route content.
   * @param {(Node | SSR.VNode)[]} newNodesArray - The DOM elements that will be added to the outlet.
   * @returns {Promise<SSR.VDocumentFragment | DocumentFragment | undefined>}
   */
  handleRelays = async (oldNodesFragment, newNodesArray) => {
    if (!this.window) return;

    // ---------------
    // Handling relays
    // ---------------
    const exitRelayNodes = findRelayNodes(oldNodesFragment);
    /** @type {Map<string, RouterRelay>} */
    const exitRelayNodeMap = new Map();
    for (const relayNode of exitRelayNodes) {
      const name = relayNode.getAttribute('data-x-relay-name');
      if (!name) continue;
      exitRelayNodeMap.set(name, relayNode);
    }
    // Creating a fragment allows query selector to work on the new nodes.
    const holder = this.window.document.createDocumentFragment();

    const newNodesArr = /** @type {Context.AsNode[]} */ (newNodesArray);
    holder.append(...newNodesArr);

    const enterRelayNodes = findRelayNodes(holder);

    for (const enterRelay of enterRelayNodes) {
      const name = enterRelay.getAttribute('data-x-relay-name');
      const correspondingExit = name ? exitRelayNodeMap.get(name) : undefined;
      if (!correspondingExit) {
        // No corresponding exit relay found.
        // if the relay already has contents, it is most likely a relay that was
        // cached and is being reused. We can skip the render step.
        if (
          enterRelay.childNodes.length === 0 ||
          !oldNodesFragment.__keepAlive
        ) {
          const props = enterRelay.__props ?? {};
          /** @type {(SSR.VNode | Node)[]} */
          let relayContents = [];
          if (enterRelay.__render) {
            relayContents = generateChildNodes(enterRelay.__render(props));
            linkNodesToComponent(relayContents, enterRelay.__render, props);
          }
          const contents = /** @type {Context.AsNode[]} */ (relayContents);
          enterRelay.replaceChildren(...contents);
          enterRelay.__onNodesReceived?.(relayContents);
        } else {
          enterRelay.__onNodesReceived?.(...enterRelay.childNodes);
        }
        continue;
      }

      // There are interesting instances where, due to keep-alive, the same relay
      // node is used for both enter and exit relays. In this case there is
      // really nothing to do.
      if (correspondingExit === enterRelay) continue;

      // A corresponding exit relay was found.
      const exitRelayContents = [...correspondingExit.childNodes];
      correspondingExit.__onNodesSent?.(exitRelayContents);

      const contents = /** @type {Context.AsNode[]} */ (exitRelayContents);
      enterRelay.replaceChildren(...contents);
      enterRelay.__onNodesReceived?.(exitRelayContents);
    }

    return holder;
  };

  /**
   * @private
   * Loads the matching routes for a path.
   * @param {string} rawPath
   * @param {boolean} [navigate]
   * @param {Event} [_event]
   * Event that triggered the navigation.
   * @param {boolean} [replace]
   * @param {boolean} [forceLoad]
   */
  loadPath = async (rawPath, navigate, _event, replace, forceLoad) => {
    const [pathRoot, pathQuery] = rawPath.split('?');
    let path = pathRoot;
    // Ensures that .html is removed from the path.
    if (pathRoot.endsWith('.html')) {
      path = pathRoot.slice(0, -5);
    }
    path += pathQuery ? `?${pathQuery}` : '';
    if (this.currentPath.value?.fullPath === path && !forceLoad) {
      return;
    }

    const oldRouterHistoryLength = this.history.length;
    const oldTitle = this.window?.document.title;
    /** @type {string[]} */
    const viewTransitionTypes = [];

    const callback = async () => {
      const wasLoaded = await this.updateDOMWithMatchingPath(
        path,
        replace,
        viewTransitionTypes
      );
      const newRouterHistoryLength = this.history.length;

      if (navigate && wasLoaded) {
        // If the new history length is less than the old history length
        // in stack mode, it means that the user navigated backwards in the history.
        // We keep popping the browser history till they are equal in length.
        if (this.stackMode && newRouterHistoryLength < oldRouterHistoryLength) {
          const negativeDiff = newRouterHistoryLength - oldRouterHistoryLength;
          this.window?.history.go(negativeDiff);
          return;
        }

        // otherwise, we can assume that the user navigated forward in the history.
        //
        // Title management becomes difficult here, because if the title
        // changed during navigation, the browser would end up
        // storing the new title with the old route,
        // which leads to a confusing experience.
        if (this.window) {
          const currentWindowPath = getFullPath(this.window);
          const isSamePath =
            currentWindowPath === this.currentPath.value.fullPath;
          if (isSamePath) return;

          const newTitle = this.window.document?.title;
          if (oldTitle && newTitle !== oldTitle) {
            this.window.document.title = oldTitle;
          }

          const nextPath = this.currentPath.value.fullPath;

          if (replace || newRouterHistoryLength === oldRouterHistoryLength) {
            this.window.history?.replaceState(null, '', nextPath);
          } else this.window.history?.pushState(null, '', nextPath);

          if (newTitle) {
            this.window.document.title = newTitle;
          }
        }
      }
    };

    if (
      this.useViewTransitions &&
      this.window?.document &&
      'startViewTransition' in this.window.document
    ) {
      const transition = this.window.document.startViewTransition(callback);
      // It's weird.
      // The navigation direction cannot be determined until the router has finished updating the DOM.
      // But since its required for accurate view transitions, we need to wait for the update to finish.
      // Better men would have written better code.
      transition.updateCallbackDone.then(() => {
        for (const type of viewTransitionTypes) {
          // @ts-ignore: The types property is not available yet in Typescript.
          /** @type {Set<string>} */ transition.types?.add(type);
        }
      });
      await transition.finished;
    } else {
      await callback();
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
            savedHistoryArray.at(-1) === this.history[0]
          ) {
            savedHistoryArray.pop();
          }
          this.history = savedHistoryArray.concat(this.history);
        }
      } catch (error) {
        console.error('Error parsing session history:', error);
      }
    }

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    this.defineWebComponents();

    this.window?.addEventListener('popstate', async (event) => {
      if (!this.isLoading && this.window) {
        this.isLoading = true;
        const path = getFullPath(this.window);
        await this.loadPath(path, false, event);
        this.isLoading = false;
      }
    });

    this.window?.addEventListener('hashchange', async (event) => {
      if (!this.isLoading && this.window) {
        this.isLoading = true;
        const path = getFullPath(this.window);
        await this.loadPath(path, false, event);
        this.isLoading = false;
      }
    });

    this.window?.addEventListener('load', async (event) => {
      if (!this.isLoading && this.window) {
        this.isLoading = true;
        const path = getFullPath(this.window);
        await this.loadPath(path, false, event);
        this.isLoading = false;
      }
    });

    this.window?.addEventListener('DOMContentLoaded', async (event) => {
      if (!this.isLoading && this.window) {
        this.isLoading = true;
        const path = getFullPath(this.window);
        await this.loadPath(path, false, event);
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
 * @returns {RouteRecords}
 */
export function defineRoutes(routes) {
  return routes;
}

/**
 * Wrapper function for defining a single route.
 * @param {RouteRecord} route
 * @returns {RouteRecord}
 */
export function defineRoute(route) {
  return route;
}

/**
 * Constructs a path with its hash and search parameters.
 * @param {Context.WindowLike} window
 * @returns {string}
 */
function getFullPath(window) {
  return (
    window.location.pathname + window.location.search + window.location.hash
  );
}

/**
 * Generates a DocumentFragment node with a text node indicating that the specified route path was not found.
 *
 * @param {string} path - The route path that was not found.
 * @param {Context.WindowLike} window - The window object.
 * @returns {DocumentFragment & SSR.VDocumentFragment} A DocumentFragment node containing a text node with the "Route not found" message.
 */
function emptyRoute(path, window) {
  console.warn(`Route not found: ${path}`);
  const node = window.document.createDocumentFragment();
  const text = window.document.createTextNode(`Route not found: ${path}`);
  node.appendChild(/** @type {*} */ (text));
  return /** @type {DocumentFragment & SSR.VDocumentFragment} */ (node);
}

/**
 * Constructs a URL path by replacing any matched parameters in the given path with their corresponding values from the `matchResult.params` object. If a parameter is not found, the original match is returned. Additionally, any search query parameters from `matchResult.searchQueryParams` are appended to the final path.
 * @param {string} path - The original path to be constructed.
 * @param {{ params: Map<string, string>, searchQueryParams: URLSearchParams }} matchResult - An object containing the matched parameters and search query parameters.
 * @returns {string} The final constructed URL path.
 */
function constructURL(path, matchResult) {
  // Replace each matched parameter with its corresponding value from the params object.
  let finalPath = path.replace(PARAM_REGEX, (match, paramName) => {
    return matchResult.params.get(paramName) || match; // If the parameter is not found, return the original match.
  });

  if (matchResult.searchQueryParams.size > 0) {
    finalPath += `?${matchResult.searchQueryParams.toString()}`;
  }

  return finalPath;
}

/**
 * @typedef {Element & {
 *  __recordedScrollTop: number,
 *  __recordedScrollLeft: number
 * }} RecordedElement
 */

/**
 * Traverses through a set of DOM nodes to record their scroll positions.
 * @param {SSR.VDocumentFragment | DocumentFragment} fragment
 */
function recordScrollPositions(fragment) {
  for (const node of fragment.childNodes) {
    if (!('scrollTop' in node)) continue;

    const element = /** @type {RecordedElement} */ (node);
    element.__recordedScrollTop = element.scrollTop;
    element.__recordedScrollLeft = element.scrollLeft;
  }
}

/**
 * @param {SSR.VNode | ParentNode | null | undefined} root
 * @returns {RouterOutlet | null}
 */
function findOutletNode(root) {
  if (!root) return null;

  if (isVNode(root)) {
    return /** @type {RouterOutlet} */ (
      root.findNode((node) => node.tagName === 'UNFINISHED-ROUTER-OUTLET')
    );
  }

  return /** @type {RouterOutlet} */ (
    root.querySelector('unfinished-router-outlet')
  );
}

/**
 * @param {SSR.VNode | ParentNode | null | undefined} root
 * @returns {RouterRelay[]}
 */
function findRelayNodes(root) {
  if (!root) return [];

  if (isVNode(root)) {
    return /** @type {RouterRelay[]} */ (
      root.findNodes((node) => node.tagName === 'UNFINISHED-ROUTER-RELAY')
    );
  }

  return /** @type {RouterRelay[]} */ ([
    ...root.querySelectorAll('unfinished-router-relay'),
  ]);
}

/**
 *
 * @param {RouterOutlet} outlet
 * @param {DocumentFragment | SSR.VDocumentFragment} fragment
 * @param {Context.WindowLike} [window]
 */
function renderRouteIntoOutlet(outlet, fragment, window) {
  const contents = /** @type {Context.AsNode[]} */ (fragment.childNodes);
  outlet.replaceChildren(...contents);

  if (outlet.__keepAlive) {
    for (const node of outlet.childNodes) {
      if ('__recordedScrollTop' in node) {
        const element = /** @type {RecordedElement} */ (node);
        element.scrollTop = element.__recordedScrollTop;
        element.scrollLeft = element.__recordedScrollLeft;
      }

      const path = outlet.getAttribute('data-path');
      if (!path) return;

      const cache = outlet.__keepAliveCache?.get(path);
      if (cache) {
        outlet.scrollTo({
          left: cache.outletScroll[0],
          top: cache.outletScroll[1],
          behavior: 'instant',
        });

        window?.scrollTo({
          left: cache.windowScroll[0],
          top: cache.windowScroll[1],
          behavior: 'instant',
        });
      }
    }
  }
}
