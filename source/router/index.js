import { Cell, SourceCell } from '@adbl/cells';
import {
  setAttribute,
  setAttributeFromProps,
  appendChild,
} from '../library/jsx.js';
import { generateChildNodes, FixedSizeMap } from '../library/utils.js';
import { LazyRoute } from './lazy.js';
import { RouterMiddlewareResponse } from './middleware.js';
import { MatchResult, RouteTree } from './routeTree.js';

export * from './lazy.js';
export * from './routeTree.js';
export * from './middleware.js';

const HISTORY_STORAGE_KEY = 'rhistory';
const PARAM_REGEX = /:(\w+)/g;

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

/** @typedef {HTMLElement | SVGAElement | MathMLElement} DomElement */

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

/** @typedef {(nodes: Node[]) => PromiseOrNot<void>} RelayCallback */

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
 *
 * @property {boolean} [animated]
 * If set to `false`, the relay will not animate the transition between routes.
 * It defaults to `true`.
 *
 * @property {number} [duration]
 * The duration of the relay transition in milliseconds.
 * It defaults to `300`.
 *
 * @property {string} [easing]
 * The easing function of the relay transition.
 * It defaults to `ease`.
 */

/**
 * @typedef RouteSnapShot
 *
 * @property {Node[]} nodes
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
 * @typedef {HTMLDivElement & {
 *  __animationOptions?: AnimationOptions;
 *  __keepAlive?: boolean;
 *  __keepAliveCache?: FixedSizeMap<string, RouteSnapShot>;
 * }} RouterOutlet
 */

/**
 * @template [SourceProps=object]
 * @template {(props: SourceProps) => JSX.Template} [SourceFn=(props: SourceProps) => JSX.Template]
 * @typedef {HTMLDivElement & {
 *  __name?: string;
 *  __props: SourceProps;
 *  __render?: SourceFn;
 *  __onNodesReceived?: (nodes: Node[]) => void;
 *  __onNodesSent?: (nodes: Node[]) => void;
 *  __animated?: boolean;
 *  __duration?: number;
 *  __easing?: string;
 *  __vacuum?: HTMLElement;
 *  __pausedAnimations?: RelayAnimation[];
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
 * @property {RouterRelayOptions} [relayOptions]
 * Options for the handling of router relays.
 */

/**
 * @typedef RouterRelayOptions
 *
 * @property {number} [relayLayerIndex]
 * The z-index to set on the element that will handle relay transitions.
 * It defaults to 9999.
 *
 * @property {boolean} [animated]
 * Whether to animate the relay transitions.
 * It defaults to true.
 *
 * @property {number} [duration]
 * The default duration of relay transitions in milliseconds.
 * It defaults to 300.
 *
 * @property {string} [easing]
 * The default easing function for relay transitions.
 * It defaults to 'ease'.
 */

/**
 * @template T
 * @typedef {T | Promise<T>} PromiseOrNot
 */

/**
 * @typedef {'onBeforeEnter' | 'onBeforeExit' | 'onAfterEnter' | 'onAfterExit'} AnimationCallbackKey
 */

/** @typedef {(nodes: Node[]) => PromiseOrNot<void | Omit<AnimationOptions, AnimationCallbackKey>>} PreAnimationCallback */

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
 * @property {string} [easing]
 * The easing function for the animation.
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
 * @typedef {'normal' | 'reverse'} NavigationDirection
 */

/**
 * @typedef {CSSTransition & { __pausedByRelay: boolean }} RelayAnimation
 */

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
 * The router provides additional features like animations, caching, and
 * advanced navigation patterns that can be added as your needs grow.
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

  /** @private @type {SourceCell<import('./middleware.js').RouteData>} */
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

  /** @private @type {Required<RouterRelayOptions>} */
  relayOptions;

  /** @private @type {boolean} */
  relaySheetAttached;

  /**
   * Defines an anchor element and handles click events to navigate to the specified route.
   *
   * @type {(props?: RouterLinkProps) => HTMLAnchorElement}
   * @param {RouterLinkProps} props - The component props.
   * @returns {HTMLAnchorElement} The rendered anchor element.
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
  Link;

  /**
   * Defines an element that serves as the router outlet, rendering the component
   * associated with the current route.
   *
   * This component is used internally by the {@link Router} class to handle route changes and
   * render the appropriate component.
   * @type {(props?: RouterOutletProps) => HTMLDivElement}
   * @param {RouterOutletProps} props
   * @returns {HTMLDivElement} The rendered div element that serves as the router outlet.
   *
   * @example
   * ```tsx
   * // Basic usage
   * <router.Outlet />
   *
   * // With animations
   * <router.Outlet
   *   animationOptions={{
   *     name: 'fade',
   *     duration: 300,
   *   }}
   * />
   * ```
   */
  Outlet;

  /**
   * A component that enables smooth transitions of DOM nodes between routes.
   *
   * The Relay component maintains continuity of elements across route changes by
   * preserving and transferring nodes between matching relay instances. Each relay
   * instance is identified by a unique name and can define how nodes are handled
   * during transitions.
   *
   * @type {<Props, SourceFn extends (props: Props) => JSX.Template>(props: RouterRelayProps<Props, SourceFn>) => HTMLDivElement}
   * @returns {HTMLDivElement} The rendered div element that serves as the relay container.
   *
   * @example
   * ```tsx
   * // Base component
   * function Photo({ photo }) {
   *   return <img src={photo.url} alt={photo.alt} />;
   * }
   *
   * // in `/list` route
   * <router.Relay
   *   id="card-photo"
   *   source={Photo}
   *   sourceProps={{ photo }}
   * />
   *
   * // in `/detail` route
   * <router.Relay
   *   id="card-photo"
   *   source={Photo}
   *   sourceProps={{ photo }}
   * />
   * ```
   *
   * As you move between routes, the elements will transition from one state to the next.
   */
  Relay;

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
    this.currentPath = Cell.source(
      /** @type {import('./middleware.js').RouteData} */ ({})
    );

    this.redirectStackCount = 0;
    this.rendering = Promise.resolve(false);
    this.links = [];
    this.params = new Map();
    this.stackMode = routeOptions.stackMode ?? false;
    this.relayOptions = {
      relayLayerIndex: 9999,
      animated: true,
      duration: 300,
      easing: 'ease',
      ...routeOptions.relayOptions,
    };
    this.routerHistory = [];
    this.relaySheetAttached = false;

    // ---------------
    // Outlet Implementation
    // ---------------
    this.Outlet = (props) => {
      if (!this.window) {
        throw new Error('Cannot create Outlet in undefined window.');
      }

      /** @type {RouterOutlet } */
      const outlet = this.window.document.createElement('div');

      if (props) {
        const {
          keepAlive,
          maxKeepAliveCount,
          animationOptions,
          children,
          ...rest
        } = props;
        for (const [key, value] of Object.entries(rest)) {
          // @ts-expect-error: The outlet is not of the type JsxElement.
          setAttributeFromProps(outlet, key, value);
        }

        // @ts-expect-error: The outlet is not of the type JsxElement.
        appendChild(outlet, outlet.tagName.toLowerCase(), props.children);
      }

      outlet.toggleAttribute('data-grenade-outlet', true);
      outlet.setAttribute('data-router-id', this.id);

      if (props) {
        if (props.animationOptions) {
          outlet.__animationOptions = props.animationOptions;
        }
        if (props.keepAlive) {
          outlet.__keepAlive = props.keepAlive;
          const maxKeepAliveCount = props.maxKeepAliveCount ?? 10;
          outlet.__keepAliveCache = new FixedSizeMap(maxKeepAliveCount);
        }
      }

      return outlet;
    };

    // ---------------
    // Link Implementation
    // ---------------
    this.Link = (props) => {
      if (!this.window) {
        throw new Error('Cannot create Link in undefined window.');
      }
      const a = this.window?.document.createElement('a');
      if (!props || !('href' in props)) {
        console.error('missing to attribute for link component.');
      }

      if (props) {
        const { children, ...rest } = props;
        for (const [key, value] of Object.entries(rest)) {
          // @ts-expect-error: a is not of type JsxElement.
          setAttribute(a, key, value);
        }

        // @ts-expect-error: The outlet is not of the type JsxElement.
        appendChild(a, a.tagName.toLowerCase(), props.children);
      }

      /**
       * @param {Event} event
       */
      const handleNavigate = (event) => {
        if (this.isLoading) {
          event.preventDefault();
          return;
        }
        // Only navigate if the href is not a valid URL.
        // For valid URLs, the browser will handle the navigation.
        const href = a.getAttribute('href');
        if (href && !URL.canParse(href)) {
          event.preventDefault();
          this.navigate(href);
        }
      };

      a.addEventListener('click', handleNavigate);

      return a;
    };
    this.Link = this.Link.bind(this);

    // ---------------
    // Relay Implementation
    // ---------------
    this.Relay = (props) => {
      if (!this.window) {
        throw new Error('Cannot create Relay in undefined window.');
      }
      this.attachRelayStyles();

      /** @type {RouterRelay<NonNullable<NonNullable<(typeof props)>['sourceProps']>>} */ //@ts-ignore: The type is correct, but the type is not.
      const relay = this.window.document.createElement('div');
      relay.toggleAttribute('data-x-relay', true);

      relay.__easing = props?.easing ?? this.relayOptions.easing;
      relay.__animated = props?.animated ?? this.relayOptions.animated;
      relay.__duration = props?.duration ?? this.relayOptions.duration;

      if (props) {
        if (props.id) {
          relay.dataset.xRelayName = props.id;
          relay.__name = props.id;
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
            const nodes = generateChildNodes(relay.__render?.(relay.__props));
            // @ts-ignore: The relay is not of the type JsxElement.
            appendChild(relay, relay.tagName.toLowerCase(), nodes);
            relay.__onNodesReceived?.(nodes);
          }
        }

        if (props.onNodesSent) {
          relay.__onNodesSent = props.onNodesSent;
        }
      }

      return relay;
    };
  }

  attachRelayStyles() {
    if (this.relaySheetAttached) return;

    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(
      `[data-x-relay] {
        display: inline-block;
        overflow: hidden;
      }`
    );
    this.window?.document.adoptedStyleSheets?.push(styleSheet);
    this.relaySheetAttached = true;
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
   * 4. Handles route transitions and animations
   * 5. Updates the browser history
   *
   * @param {string} path - The path to navigate to
   * @return {Promise<void>} A promise that resolves when the navigation is complete.
   */
  navigate = async (path) => {
    this.isLoading = true;
    if (path === '#') {
      return;
    }
    await this.loadPath(path, true);
    this.isLoading = false;
  };

  /**
   * Navigates back in the browser's history.
   *
   * When called, triggers a history.back() which the router will detect and handle,
   * running any configured exit animations in reverse.
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
        this.currentPath.value,
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
      if (outlet === undefined) break;

      if (outlet.dataset.path === currentMatchedRoute.fullPath) {
        outletIndex++;
        lastMatchedRoute = currentMatchedRoute;
        currentMatchedRoute = currentMatchedRoute.child;
        continue;
      }

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

      const renderedComponent =
        outlet.__keepAliveCache?.get(path)?.nodes ?? matchedComponent();

      const oldPath = this.currentPath.value?.fullPath;
      if (this.currentPath.value?.fullPath !== currentMatchedRoute.fullPath) {
        this.currentPath.value = {
          name: currentMatchedRoute.name,
          fullPath: substituteParameters(
            currentMatchedRoute.fullPath,
            matchResult.params
          ),
          params: matchResult.params,
          query: matchResult.searchQueryParams,
        };
      }

      // if the component performs a redirect, it would change the route
      // stored in the outlet's dataset, so we need to check before replacing.
      if (outlet.dataset.path !== currentMatchedRoute.fullPath) {
        return false;
      }

      const animationDirection = this.chooseNavigationDirection(
        currentMatchedRoute.fullPath
      );

      // if the outlet is keep alive, we need to cache the current nodes
      if (outlet.__keepAlive && oldPath) {
        const nodes = Array.from(outlet.childNodes);
        recordScrollPositions(nodes);
        outlet.__keepAliveCache?.set(oldPath, {
          nodes,
          outletScroll: [outlet.scrollLeft, outlet.scrollTop],
          windowScroll: [this.window?.scrollX ?? 0, this.window?.scrollY ?? 0],
        });
      }

      const newNodes = generateChildNodes(renderedComponent);

      const replaced = await this.handleAnimations(
        outlet,
        newNodes,
        animationDirection
      );
      if (!replaced) {
        renderRouteIntoOutlet(outlet, newNodes, this.window);
      }

      if (
        this.window &&
        (currentMatchedRoute.title || lastMatchedRoute.title)
      ) {
        const title = currentMatchedRoute.title || lastMatchedRoute.title || '';
        this.window.document.title = title;
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

    if (this.redirectStackCount > 0) {
      this.redirectStackCount--;
    }

    return true;
  };

  getRouterPathHistory() {
    return [...this.routerHistory];
  }

  /**
   * @private
   * @param {string} targetPath
   * @returns {NavigationDirection}
   */
  chooseNavigationDirection = (targetPath) => {
    /** @type {NavigationDirection} */
    let animationDirection = 'normal';
    const currentPath = this.routerHistory.at(-1);
    if (!this.stackMode || currentPath === targetPath) {
      return animationDirection;
    }

    const previousIndex = this.routerHistory.findLastIndex(
      (path) => path === targetPath
    );
    if (previousIndex !== -1) {
      animationDirection = 'reverse';
      while (this.routerHistory.length > previousIndex + 1) {
        this.popHistory();
      }
    } else {
      // If the path is not found, we need to push the new path to the history.
      this.pushHistory(targetPath);
    }

    return animationDirection;
  };

  /**
   * Returns a reactive cell that contains the current route data.
   */
  getCurrentRoute() {
    return Cell.derived(() => {
      return {
        ...this.currentPath.value,
      };
    });
  }

  /**
   * @private
   * Handles animations and relay transitions for DOM elements during route changes.
   * @param {RouterOutlet} outlet - The DOM element that will contain the new route content.
   * @param {Node[]} newNodes - The DOM elements that will be added to the outlet.
   * @param {NavigationDirection} animationDirection - The direction of the animation, either 'enter' or 'exit'.
   *
   * @returns {Promise<void | boolean>}
   * A Promise that resolves when the animations are complete. It will return true if the nodes were replaced
   * during animation.
   */
  handleAnimations = async (outlet, newNodes, animationDirection) => {
    const animationOptions = outlet.__animationOptions ?? {};
    if (!this.window) return;

    // ---------------
    // Handling relays
    // ---------------
    /**
     * @type {HTMLElement}
     * A dummy top-layer that will be maintain the relay
     * positioning.
     */
    let topLayer;
    /** @type {DOMRect} */
    let relayStartRect;
    /** @type {{ width: number, height: number }} */
    let relayEndDim;
    /** @type {RouterRelay[]} */
    const exitRelayNodes = Array.from(
      outlet.querySelectorAll('[data-x-relay]')
    );
    /** @type {Map<string, RouterRelay>} */
    const exitRelayNodeMap = new Map();
    for (const relayNode of exitRelayNodes) {
      const name = relayNode.dataset.xRelayName;
      if (!name) continue;
      exitRelayNodeMap.set(name, relayNode);
    }
    // Creating a fragment allows query selector to work on the new nodes.
    const holder = this.window.document.createDocumentFragment();
    holder.append(...newNodes);
    /** @type {RouterRelay[]} */
    const enterRelayNodes = Array.from(
      holder.querySelectorAll('[data-x-relay]')
    );

    const relayExecutorStart = async () => {
      for (const enterRelay of enterRelayNodes) {
        const name = enterRelay.dataset.xRelayName;
        if (!name) continue;
        const correspondingExit = exitRelayNodeMap.get(name);

        if (!correspondingExit) {
          // No corresponding exit relay found.
          // if the relay already has contents, it is most likely a relay that was
          // cached and is being reused. We can skip the render step.
          if (enterRelay.childNodes.length === 0 || !outlet.__keepAlive) {
            const props = enterRelay.__props ?? {};
            const relayContents = generateChildNodes(
              enterRelay.__render?.(props)
            );
            enterRelay.replaceChildren(...relayContents);
            enterRelay.__onNodesReceived?.(relayContents);
          } else {
            enterRelay.__onNodesReceived?.(Array.from(enterRelay.childNodes));
          }
          continue;
        }

        // A corresponding exit relay was found.
        const exitRelayContents = Array.from(correspondingExit.childNodes);
        correspondingExit.__onNodesSent?.(exitRelayContents);
        correspondingExit.dataset.xRelayMatched = 'true';

        if (!enterRelay.__animated) {
          enterRelay.replaceChildren(...exitRelayContents);
          enterRelay.__onNodesReceived?.(exitRelayContents);
          continue;
        }

        const animations = /** @type {RelayAnimation[]} */ (
          correspondingExit
            .getAnimations({ subtree: true })
            .filter((animation) => animation instanceof CSSTransition)
        );

        for (const animation of animations) {
          animation.pause();
          /** @type {RelayAnimation} */ (animation).__pausedByRelay = true;
        }

        relayStartRect = correspondingExit.getBoundingClientRect();
        relayEndDim = getFinalRect(correspondingExit);
        if (!topLayer && this.window && correspondingExit.__animated) {
          topLayer = this.window.document.createElement('div');
          topLayer.style.position = 'fixed';
          topLayer.style.top = '0';
          topLayer.style.left = '0';
          topLayer.style.width = '100%';
          topLayer.style.height = '100%';
          topLayer.style.pointerEvents = 'none';
          topLayer.style.zIndex = this.relayOptions.relayLayerIndex.toString();
        }

        if (topLayer && this.window) {
          const exitRelayVacuum = this.window.document.createElement('div');

          exitRelayVacuum.style.height = `${relayStartRect.height}px`;
          exitRelayVacuum.style.width = `${relayStartRect.width}px`;

          correspondingExit.replaceWith(exitRelayVacuum);
          correspondingExit.__vacuum = exitRelayVacuum;

          const enterRelayVacuum = this.window.document.createElement('div');

          enterRelayVacuum.style.height = `${relayEndDim.height}px`;
          enterRelayVacuum.style.width = `${relayEndDim.width}px`;

          enterRelay.replaceWith(enterRelayVacuum);
          enterRelay.__vacuum = enterRelayVacuum;

          enterRelay.setAttribute(
            'style',
            `position: fixed; 
            top: ${relayStartRect.top}px; 
            left: ${relayStartRect.left}px; 
            width: ${relayStartRect.width}px; 
            height: ${relayStartRect.height}px;`
          );
          topLayer.append(enterRelay);
        }

        enterRelay.__pausedAnimations = animations;
        enterRelay.replaceChildren(...exitRelayContents);
        for (const animation of animations) {
          // Pausing an animation stabilizes the state of the element,
          // even if it has changed parents.
          animation.pause();
        }
      }

      if (!topLayer) return;

      if (this.relayOptions.relayLayerIndex < 0) {
        this.window?.document.body.prepend(topLayer);
      } else {
        this.window?.document.body.append(topLayer);
      }
    };

    // ---------------
    // Relay Cleanup
    // ---------------
    const relayExecutorFinish = async () => {
      await Promise.all([
        Promise.all(
          [...exitRelayNodeMap].map(async ([_, exitRelay]) => {
            exitRelay.removeAttribute('data-x-relay-matched');
            await transitionRelay(exitRelay, relayStartRect, relayEndDim);
          })
        ),
        Promise.all(
          enterRelayNodes.map(async (enterRelay) => {
            enterRelay.__onNodesReceived?.(Array.from(enterRelay.childNodes));
            await transitionRelay(enterRelay, relayStartRect, relayEndDim);
          })
        ),
      ]);

      topLayer?.remove();
    };

    // ---------------
    // Exiting previous nodes.
    // ---------------
    const exitAnimationExecutor = async () => {
      const oldNodes = Array.from(outlet.childNodes);
      //@ts-ignore
      const { name, duration, easing } = {
        ...animationOptions,
        ...(await animationOptions.onBeforeExit?.(oldNodes)),
      };
      await Promise.all(
        oldNodes.map(async (node) => {
          if (!name || !('style' in node || 'getAnimations' in node)) return;
          const element = /** @type {DomElement} */ (node);
          // ignore relays
          if (element.dataset?.xRelayMatched) return;
          const finalDuration = `${duration ?? 0}ms`;
          const finalEasing = easing ?? 'ease-in';
          const finalName =
            animationDirection === 'reverse' ? `${name}-enter` : `${name}-exit`;
          // duration | easing-function | delay | iteration-count | direction | fill-mode | name
          element.style.animation = `${finalDuration} ${finalEasing} 0s 1 ${animationDirection} both ${finalName}`;
          await Promise.all(
            element.getAnimations({ subtree: true }).map((a) => a.finished)
          );
        })
      );
      await animationOptions.onAfterExit?.(oldNodes);
      // // The animations are removed after the hook runs so that they don't glitch
      // // back to their original state if there is a delay.
      for (const node of oldNodes) {
        if (!('style' in node)) continue;
        const element = /** @type {DomElement} */ (node);
        // ignore relays
        if (element.dataset?.xRelayMatched) return;
        element.style.removeProperty('animation');
      }
    };

    // Entering new nodes.
    const enterAnimationExecutor = async () => {
      const newNodes = Array.from(holder.childNodes);
      const { name, duration, easing } = {
        ...animationOptions,
        ...(await animationOptions.onBeforeEnter?.(newNodes)),
      };
      if (!name) {
        renderRouteIntoOutlet(outlet, newNodes, this.window);
        await Promise.all([
          relayExecutorFinish(),
          animationOptions.onAfterEnter?.(newNodes),
        ]);
        return;
      }

      for (const node of newNodes) {
        // Skip non-HTML elements, and elements created in non-browser environments.
        if (!('style' in node || 'getAnimations' in node)) continue;
        const element = /** @type {DomElement} */ (node);
        // ignore relays
        if (element.dataset?.xRelayMatched) return;

        const finalDuration = `${duration ?? 0}ms`;
        const finalEasing = easing ?? 'ease-in';
        const finalName =
          animationDirection === 'reverse' ? `${name}-exit` : `${name}-enter`;

        // duration | easing-function | delay | iteration-count | direction | fill-mode | name
        element.style.animation = `${finalDuration} ${finalEasing} 0s 1 ${animationDirection} both ${finalName} `;
      }

      // The new nodes need to be added to the DOM before the animation starts.
      renderRouteIntoOutlet(outlet, newNodes, this.window);

      await Promise.all([
        relayExecutorFinish(),
        Promise.all(
          newNodes.map(async (node) => {
            // Skip non-HTML elements, and elements created in non-browser environments.
            if (!('style' in node || 'getAnimations' in node)) return;

            const element = /** @type {DomElement} */ (node);
            // ignore relays
            if (element.dataset?.xRelayMatched) return;
            await Promise.all(element.getAnimations().map((a) => a.finished));
            element.style.removeProperty('animation');
          })
        ).then(() => animationOptions.onAfterEnter?.(newNodes)),
      ]);
    };

    await relayExecutorStart();
    await exitAnimationExecutor();
    await enterAnimationExecutor(); // the relay executor finish runs inside.

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
    if (this.currentPath.value?.fullPath === path) {
      return;
    }

    const oldRouterHistoryLength = this.routerHistory.length;
    const oldTitle = this.window?.document.title;
    const wasLoaded = await this.updateDOMWithMatchingPath(path);
    const newRouterHistoryLength = this.routerHistory.length;

    for (const link of this.links) {
      link.toggleAttribute(
        'active',
        Boolean(
          this.currentPath.value?.fullPath &&
            link.dataset.href?.startsWith(this.currentPath.value.fullPath)
        )
      );
    }

    if (navigate && wasLoaded) {
      // If the new history length is less than the old history length
      // in stack mode, it means that the user navigated backwards in the history.
      // We keep popping the browser history till they are equal in length.
      if (this.stackMode && newRouterHistoryLength < oldRouterHistoryLength) {
        let i = oldRouterHistoryLength;
        // Detaching the window prevents the router from reacting to any events
        // triggered by going back.
        const window = this.window;
        this.window = undefined;
        while (window && newRouterHistoryLength < i) {
          window.history.back();
          i--;
        }
        this.window = window;
        return;
      }

      // If the new history length is equal to the old history length,
      // in stack mode, it means no navigation occurred:
      if (this.stackMode && newRouterHistoryLength === oldRouterHistoryLength) {
        return;
      }

      // otherwise, we can assume that the user navigated forward in the history.
      //
      // Title management becomes difficult here, because if the title
      // changed during navigation, the browser would end up
      // storing the new title with the old route,
      // which leads to a confusing experience.
      if (this.window) {
        const newTitle = this.window.document?.title;
        if (oldTitle && newTitle !== oldTitle) {
          this.window.document.title = oldTitle;
        }

        this.window.history?.pushState(null, '', path);

        if (newTitle) {
          this.window.document.title = newTitle;
        }
      }
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

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
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
        await this.loadPath(this.window.location.pathname, false, event);
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

/**
 * Calculates the final bounding rectangle of an element before any ongoing animations end.
 * This function traverses up the DOM tree from the given element, collecting all active animations.
 * It then moves all animations to their final state, gets the final bounding rectangle of the element, and resets the animations.
 * This is useful for cases where an element's position or size changes due to animations, and you need to know the final layout before the animations complete.
 * @param {DomElement} element - The element to get the final bounding rectangle for.
 * @returns {DOMRect} The final bounding rectangle of the element.
 */
function getFinalRect(element) {
  const animations = [];
  /** @type {DomElement | null} */
  let currentElement = element;

  // Traverse up the DOM tree to collect all animations.
  while (currentElement) {
    animations.push(
      ...currentElement.getAnimations({ subtree: element === currentElement })
    );
    currentElement = currentElement.parentElement;
  }

  // Move all animations to their final state
  for (const animation of animations) {
    animation.pause();
    if (animation.effect) {
      Reflect.set(animation, '__currentTime', animation.currentTime);
      const endTime = animation.effect.getComputedTiming().endTime;
      animation.currentTime = endTime ?? null;
    }
  }
  const finalRect = element.getBoundingClientRect();

  // Reset animations
  for (const animation of animations) {
    if (/** @type {RelayAnimation} */ (animation).__pausedByRelay !== true) {
      animation.play();
    }
    animation.currentTime = Reflect.get(animation, '__currentTime');
  }

  return finalRect;
}

/**
 *
 * @param {RouterRelay} relay
 * @param {DOMRect} initialRect
 * @param {{width: number, height: number}} endDimensions
 */
async function transitionRelay(relay, initialRect, endDimensions) {
  if (!relay.__vacuum) return;

  const vacuumRect = getFinalRect(relay.__vacuum);

  // Calculate the transform needed to move from current to vacuum position
  const deltaX = vacuumRect.left - initialRect.left;
  const deltaY = vacuumRect.top - initialRect.top;

  const keyframes = [
    {
      transform: `translate(${deltaX}px, ${deltaY}px)`,
      height: `${endDimensions.height}px`,
      width: `${endDimensions.width}px`,
    },
  ];

  if (relay.__pausedAnimations) {
    for (const animation of relay.__pausedAnimations) {
      animation.play();
    }
  }

  await Promise.all([
    relay.animate(keyframes, {
      duration: relay.__duration,
      easing: relay.__easing,
    }).finished,
    relay.__pausedAnimations?.map((animation) => animation.finished),
  ]);
  relay.__pausedAnimations = undefined;

  relay.__vacuum?.replaceWith(relay);
  relay.style.cssText = `transition-duration: ${relay.__duration}ms`;

  await Promise.all(
    relay.getAnimations?.().map((animation) => animation.finished)
  );

  relay.removeAttribute('style');
  relay.__vacuum = undefined;
}

/**
 * Substitutes named parameters in a path string with their corresponding values.
 *
 * @param {string} path - The path string containing named parameters.
 * @param {Map<string, string>} params - An object containing the values for the named parameters.
 * @returns {string} The path with the named parameters substituted.
 */
function substituteParameters(path, params) {
  // Replace each matched parameter with its corresponding value from the params object.
  return path.replace(PARAM_REGEX, (match, paramName) => {
    return params.get(paramName) || match; // If the parameter is not found, return the original match.
  });
}

/**
 * @typedef {Element & {
 *  __recordedScrollTop: number,
 *  __recordedScrollLeft: number
 * }} RecordedElement
 */

/**
 * Traverses through a set of DOM nodes to record their scroll positions.
 * @param {Node[]} nodes
 */
function recordScrollPositions(nodes) {
  for (const node of nodes) {
    if (!('scrollTop' in node)) continue;

    const element = /** @type {RecordedElement} */ (node);
    element.__recordedScrollTop = element.scrollTop;
    element.__recordedScrollLeft = element.scrollLeft;
  }
}

/**
 *
 * @param {RouterOutlet} outlet
 * @param {Node[]} newNodes
 * @param {Window} [window]
 */
function renderRouteIntoOutlet(outlet, newNodes, window) {
  outlet.replaceChildren(...newNodes);
  if (outlet.__keepAlive) {
    for (const node of newNodes) {
      if ('__recordedScrollTop' in node) {
        const element = /** @type {RecordedElement} */ (node);
        element.scrollTop = element.__recordedScrollTop;
        element.scrollLeft = element.__recordedScrollLeft;
      }

      const path = outlet.dataset.path;
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
