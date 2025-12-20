/** @import { Scope } from '../library/scope.js' */
/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { RouterEventTypes, RouterEventHandlerMap } from './events.js'; */
/** @import { MatchedRoute, MatchResult } from './routeTree.js'; */
/** @import { RouterMiddleware, RouteData } from './middleware.js'; */
/** @import { WindowLike } from '../context/index.js'; */
/** @import {
 *   NavigationOptions,
 *   RouterInternalState,
 *   RouterOptions,
 *   RouterLinkProps,
 *   RouterOutletProps,
 *   RouterProviderProps,
 *   RouteLevel,
 *   RouterData,
 *   ComponentOrComponentLoader,
 *   RouteRecords,
 *   RouteRecord
 * } from './types.js';
 */

import { Cell } from '@adbl/cells';
import { createScope, useScopeContext } from '../library/scope.js';
import { RouteTree } from './routeTree.js';
import { Lazy } from './lazy.js';
import h from '../library/jsx.js';
import { If } from '../library/if.js';
import {
  BeforeNavigateEvent,
  RouteChangeEvent,
  RouteErrorEvent,
  RouteLoadCompletedEvent,
  RouteLockPreventedEvent,
  RouterNavigationEvent,
} from './events.js';
import { constructURL, getFullPath } from './utils.js';
import { RouterMiddlewareResponse } from './middleware.js';
import { getGlobalContext } from '../context/index.js';
import { getActiveRenderer } from '../library/renderer.js';

export * from './lazy.js';
export * from './routeTree.js';
export * from './query.js';
export * from './middleware.js';
export * from './events.js';

/** @type {Scope<RouterData>} */
const RouterScope = createScope('Router');

// ----------
/** A client-side router for building dynamic web applications.
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
 */
export class Router extends EventTarget {
  #routeTree;
  #stackMode;
  #redirectStackCount = 0;
  #title = '';
  /** @type {string | null} */
  #lock = null;
  #currentPath;
  #isNavigating = false;
  /** @type {string[]} */
  #history = [];
  /** @type {RouterMiddleware[]} */
  #middlewares;
  #maxRedirects = 100;
  /** @type {RouterInternalState} */
  #internalState;

  /**
   * Determines whether view transitions are enabled for route changes.
   * If set to true, the router will wrap every route change in a call to
   * `document.startViewTransition()`.
   * @type {boolean}
   */
  useViewTransitions;
  Outlet = Outlet;
  Link = Link;

  get isNavigating() {
    return this.#isNavigating;
  }

  /** @param {RouterOptions} routeOptions */
  constructor(routeOptions) {
    super();
    this.#routeTree = RouteTree.fromRouteRecords(routeOptions.routes);
    this.#stackMode = routeOptions.stackMode ?? false;
    this.useViewTransitions = routeOptions.useViewTransitions ?? false;
    this.#middlewares = routeOptions.middlewares ?? [];
    this.#internalState = { metadata: new Map(), routeChain: Cell.source([]) };
    const initialPath = /** @type {RouteData} */ ({
      name: null,
      path: '',
      query: new URLSearchParams(),
      fullPath: '',
      params: new Map(),
      hash: null,
    });
    this.#currentPath = Cell.source(initialPath);

    this.navigate = this.navigate.bind(this);
    this.replace = this.replace.bind(this);
    this.back = this.back.bind(this);
    this.lock = this.lock.bind(this);
    this.unlock = this.unlock.bind(this);
    this.getCurrentRoute = this.getCurrentRoute.bind(this);
    this.#windowEventHandler = this.#windowEventHandler.bind(this);
    this.attachWindowListeners = this.attachWindowListeners.bind(this);
  }

  /** @param {string} path */
  #assertNotLocked(path) {
    if (!this.#lock) return true;
    const event = new RouteLockPreventedEvent({
      lockedPath: this.#lock,
      attemptedPath: path,
    });
    this.dispatchEvent(event);
    return false;
  }

  /**
   * @param {() => Promise<void>} callback
   * @param {string[]} transitionTypes
   */
  async #startTransition(callback, transitionTypes) {
    const { window } = getGlobalContext();
    if (
      this.useViewTransitions &&
      window?.document &&
      'startViewTransition' in window.document
    ) {
      const transition = window.document.startViewTransition(callback);
      transition.updateCallbackDone.then(() => {
        for (const type of transitionTypes) transition.types?.add(type);
      });
      await transition.finished;
    } else await callback();
    // Waits for whatever effects have been scheduled to settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * @param {string} path
   * @param {MatchResult<ComponentOrComponentLoader>} matchResult
   * @param {MatchedRoute<ComponentOrComponentLoader>} targetMatch
   * @param {RouteData | null} [workingPath]
   * @returns {Promise<string | undefined>} The final path to navigate to or preload.
   */
  async #runMiddlewares(path, matchResult, targetMatch, workingPath) {
    const currentPath = workingPath ?? this.#currentPath.get();
    /** @type {typeof currentPath | null} */
    const sourcePath = currentPath
      ? {
          name: currentPath.name,
          params: currentPath.params,
          query: currentPath.query,
          path: currentPath.path,
          fullPath: currentPath.fullPath,
          metadata: currentPath.metadata,
          hash: currentPath.hash,
        }
      : null;

    const targetPath = {
      name: targetMatch.name,
      params: matchResult.params,
      query: matchResult.searchQueryParams,
      path: targetMatch.path,
      fullPath: path,
      metadata: matchResult.metadata,
      hash: matchResult.hash,
    };
    const middlewareArgs = {
      from: sourcePath,
      to: targetPath,
    };
    for (const middleware of this.#middlewares) {
      const middlewareResponse = await middleware.callback(middlewareArgs);
      if (middlewareResponse instanceof RouterMiddlewareResponse) {
        if (middlewareResponse.type === 'redirect') {
          // Block deep redirects
          if (this.#redirectStackCount > this.#maxRedirects) {
            const message = `Your router redirected too many times (${
              this.#maxRedirects
            }). This is probably due to a circular redirect in your route configuration.`;
            console.warn(message);

            return;
          }
          // Ignore same-path redirects
          if (middlewareResponse.path === path) {
            continue;
          }
          this.#redirectStackCount++;
          return this.#runMiddlewares(
            middlewareResponse.path,
            matchResult,
            targetMatch,
            workingPath
          );
        }
      }
    }
    return path;
  }

  /**
   * Loads the matching routes for a path.
   * @param {Object} options
   * @param {string} options.rawPath
   * @param {boolean} [options.navigate]
   * @param {boolean} [options.replace]
   * @param {boolean} [options.forceLoad]
   */
  async #load(options) {
    const { rawPath, forceLoad, navigate, replace } = options;
    if (this.#lock && rawPath !== this.#lock) {
      const event = new RouteLockPreventedEvent({
        lockedPath: this.#lock,
        attemptedPath: rawPath,
      });
      this.dispatchEvent(event);
      await this.#load({ ...options, rawPath: this.#lock });
      return;
    }
    if (rawPath === '#') return;

    const [pathRoot, pathQuery] = rawPath.split('?');
    let path = pathRoot.endsWith('.html') ? pathRoot.slice(0, -5) : pathRoot;
    if (pathQuery) path += `?${pathQuery}`;
    if (this.#currentPath.get()?.fullPath === path && !forceLoad) return;

    const oldHistoryLength = this.#history.length;
    const transitionTypes = /** @type {string[]} */ ([]);

    const from = this.#getCurrentPath();
    const to = path;
    const beforeEvent = new BeforeNavigateEvent({ from, to });
    this.dispatchEvent(beforeEvent);
    if (beforeEvent.defaultPrevented) return;

    const callback = async () => {
      const wasLoaded = await this.#update(path, replace, transitionTypes);
      if (navigate && wasLoaded) {
        const event = new RouteLoadCompletedEvent({
          fullPath: this.#currentPath.get().fullPath,
          oldHistoryLength,
          newHistoryLength: this.#history.length,
          replace: Boolean(replace),
          title: this.#title,
        });
        this.dispatchEvent(event);
      }
    };

    await this.#startTransition(callback, transitionTypes);
  }

  #getCurrentPath() {
    const currentPath = this.#currentPath.get();
    return currentPath.path
      ? constructURL(currentPath.path, {
          params: currentPath.params,
          searchQueryParams: currentPath.query,
          hash: currentPath.hash,
          path: currentPath.path,
        })
      : undefined;
  }

  /**
   * Converts the nested linked list of matched routes into a flat array
   * that Outlets can easily access by depth index.
   *
   * @param {MatchResult<ComponentOrComponentLoader>} matchResult
   * @returns {Promise<{ chain: RouteLevel[], metadata: Map<string, any> }>}
   */
  async #flattenRouteChain(matchResult) {
    const chain = [];
    const unwrapPromises = [];
    let route = matchResult.subTree;

    for (let i = 0; route !== null; i++) {
      const currentRoute = route;
      if (!currentRoute.component) {
        route = route.child;
        continue;
      }

      if (currentRoute.component instanceof Lazy) {
        unwrapPromises.push(
          currentRoute.component.unwrap().then((component) => {
            currentRoute.component = component;
            chain[i] = {
              path: constructURL(currentRoute.path, matchResult, false),
              component,
            };
          })
        );
      } else {
        chain[i] = {
          path: constructURL(currentRoute.path, matchResult, false),
          component: currentRoute.component,
        };
      }

      route = route.child;
    }

    await Promise.all(unwrapPromises);
    await matchResult.collectMetadata();
    return {
      chain: chain.filter(Boolean),
      metadata: matchResult.metadata,
    };
  }

  /**
   * Discerns the direction of navigation based on the current stack.
   *
   * @param {string} targetPath
   * @param {boolean} [replace]
   * @returns {'forwards' | 'backwards' | 'neutral'}
   */
  #calculateDirection(targetPath, replace) {
    const currentPath = this.#history.at(-1);
    if (currentPath === targetPath) return 'neutral';
    if (replace) return 'neutral';

    if (this.#stackMode) {
      const previousIndex = this.#history.lastIndexOf(targetPath);
      if (previousIndex !== -1 && previousIndex < this.#history.length - 1) {
        return 'backwards';
      }
    }

    return 'forwards';
  }

  /**
   * Updates the internal history stack based on the determined direction.
   *
   * @param {string} targetPath
   * @param {boolean | undefined} replace
   * @param {'forwards' | 'backwards' | 'neutral'} direction
   */
  #updateInternalHistory(targetPath, replace, direction) {
    if (direction === 'neutral' && !replace) return;
    if (replace) {
      this.#history.pop();
      this.#history.push(targetPath);
      return;
    }

    if (direction === 'backwards' && this.#stackMode) {
      const targetIndex = this.#history.lastIndexOf(targetPath);
      if (targetIndex !== -1) {
        this.#history = this.#history.slice(0, targetIndex + 1);
      }
    } else this.#history.push(targetPath);
  }

  /** @param {string} message */
  #logError(message) {
    console.warn(message);
    const event = new RouteErrorEvent({ error: new Error(message) });
    this.dispatchEvent(event);
  }

  /**
   * Loads the route component corresponding to the specified path into the router outlet.
   *
   * @param {string} path
   * @param {boolean | undefined} replace
   * @param {string[]} transitionTypes
   * @returns {Promise<boolean>} A promise that resolves to `true` if the route was loaded successfully, `false` otherwise.
   */
  async #update(path, replace, transitionTypes) {
    if (path === '#') return false;

    // Change Event
    const thisPath = this.#getCurrentPath();
    const nextPath = path;
    const event = new RouteChangeEvent({ to: nextPath, from: thisPath });
    this.dispatchEvent(event);
    if (event.defaultPrevented) return false;

    // Matching
    const result = await this.#routeTree.match(path);
    let nextNode = result.subTree;
    let title = '';
    let deepTransition = null;
    while (nextNode) {
      if (nextNode.title) title = nextNode.title;
      if (nextNode.transitionType) deepTransition = nextNode.transitionType;
      nextNode = nextNode.child;
    }

    // Redirects
    const target = result.leaf();
    const activeRedirect = target?.redirect
      ? constructURL(target.redirect, result)
      : null;
    if (activeRedirect && activeRedirect !== path) {
      if (this.#redirectStackCount > this.#maxRedirects) {
        const message = `Error loading path ${path}: Router redirected too many times`;
        this.#logError(message);
        this.#redirectStackCount = 0;
        return false;
      }
      this.#redirectStackCount++;
      await this.navigate(activeRedirect, { replace: true });
      return false;
    }
    this.#redirectStackCount = 0;

    // Run Middlewares
    if (target === null) {
      const message = `No route matches path: ${path}`;
      this.#logError(message);
      return false;
    }
    const currentPath = this.#currentPath.get();
    const finalPath = await this.#runMiddlewares(
      path,
      result,
      target,
      currentPath
    );
    if (finalPath !== path) {
      if (finalPath !== undefined) await this.navigate(finalPath, { replace });
      return false;
    }
    if (result.subTree === null) {
      const message = `No route matches path: ${path}`;
      this.#logError(message);
      return false;
    }

    const { chain, metadata } = await this.#flattenRouteChain(result);
    Cell.batch(() => {
      const fullPath = constructURL(target.path, result);
      this.#currentPath.set({
        name: target.name,
        path: target.path,
        params: result.params,
        query: result.searchQueryParams,
        fullPath: fullPath,
        metadata,
        hash: result.hash,
      });

      this.#internalState.metadata = metadata;
      this.#internalState.routeChain.set(chain);
    });

    // Direction
    const direction = this.#calculateDirection(result.path, replace);
    transitionTypes.push(direction);
    if (deepTransition) transitionTypes.push(deepTransition);

    this.#updateInternalHistory(result.path, replace, direction);
    this.#title = title;

    return true;
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
  async navigate(path, options) {
    if (!this.#assertNotLocked(path)) return;
    this.#isNavigating = true;
    try {
      await this.#load({ rawPath: path, navigate: true, ...options });
    } finally {
      this.#isNavigating = false;
    }
  }

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
  async replace(path) {
    if (!this.#assertNotLocked(path)) return;
    this.#isNavigating = true;
    try {
      await this.#load({ rawPath: path, replace: true });
    } finally {
      this.#isNavigating = false;
    }
  }

  async back() {
    const lastPath = this.#history[this.#history.length - 2];
    if (!lastPath) return;
    if (!this.#assertNotLocked(lastPath)) return;
    this.#isNavigating = true;
    try {
      const oldHistoryLength = this.#history.length;
      this.#history.pop();
      /** @type {string[]} */
      const transitionTypes = [];

      const callback = async () => {
        const wasLoaded = await this.#update(lastPath, false, transitionTypes);
        if (!wasLoaded) return;
        const event = new RouteLoadCompletedEvent({
          fullPath: this.#currentPath.get().fullPath,
          oldHistoryLength,
          newHistoryLength: this.#history.length,
          replace: false,
          title: this.#title,
        });
        this.dispatchEvent(event);
      };
      await this.#startTransition(callback, transitionTypes);
    } finally {
      this.#isNavigating = false;
    }
  }

  /**
   * Returns a reactive cell that contains the current route data.
   */
  getCurrentRoute() {
    return Cell.derived(() => {
      return { ...this.#currentPath.get() };
    });
  }

  /**
   * @template {RouterEventTypes} EventType The type of event to listen for.
   * @param {EventType} type The name of the event to listen for.
   * @param {RouterEventHandlerMap[EventType] | null | EventListenerObject} listener   The function to execute when the event is triggered.
   * @param {EventListenerOptions} [options] An object that specifies characteristics about the event listener.
   */
  addEventListener(type, listener, options) {
    super.addEventListener(type, /**@type {any} */ (listener), options);
  }

  /**
   * @template {RouterEventTypes} EventType The type of event to remove the listener for ('routechange', 'routelockprevented').
   * @param {EventType} type The name of the event to remove the listener for.
   * @param {RouterEventHandlerMap[EventType] | null | EventListenerObject} listener The event listener function to remove.
   * @param {EventListenerOptions} [options] An object that specifies characteristics about the event listener.
   */
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, /**@type {any} */ (listener), options);
  }

  /** @param {Event} event */
  #windowEventHandler = async (event) => {
    if (this.#isNavigating) return;
    const window = /** @type {WindowLike} */ (event.currentTarget);
    this.#isNavigating = true;
    const path = getFullPath(window);
    await this.#load({ rawPath: path, navigate: false });
    this.#isNavigating = false;
  };

  /** @param {WindowLike} window */
  attachWindowListeners = (window) => {
    const handleRoutePrevented = () => {
      window.history.replaceState({}, '', this.#lock);
    };
    /** @param {RouteLoadCompletedEvent} event */
    const handleRouteLoadCompleted = (event) => {
      const { detail } = event;
      const { newHistoryLength, oldHistoryLength, replace, fullPath, title } =
        detail;
      window.document.title = title;
      const goingBack = newHistoryLength < oldHistoryLength;
      if (goingBack) {
        const negativeDiff = newHistoryLength - oldHistoryLength;
        window?.history.go(negativeDiff);
        return;
      }

      const isSamePath = getFullPath(window) === fullPath;
      if (isSamePath) return;

      const nextPath = fullPath;
      if (replace || newHistoryLength === oldHistoryLength) {
        window.history?.replaceState(null, '', nextPath);
      } else window.history?.pushState(null, '', nextPath);
    };

    if (
      'customElements' in window &&
      !window.customElements.get('retend-router-outlet')
    ) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('retend-router-outlet { display: contents; }');
      window.document.adoptedStyleSheets.push(sheet);
      window.customElements.define(
        'retend-router-outlet',
        class extends HTMLElement {}
      );
    }

    window?.addEventListener('popstate', this.#windowEventHandler);
    window?.addEventListener('hashchange', this.#windowEventHandler);
    window?.addEventListener('load', this.#windowEventHandler);
    window?.addEventListener('DOMContentLoaded', this.#windowEventHandler);
    this.addEventListener('routelockprevented', handleRoutePrevented);
    this.addEventListener('routeloadcompleted', handleRouteLoadCompleted);

    return () => {
      window?.removeEventListener('popstate', this.#windowEventHandler);
      window?.removeEventListener('hashchange', this.#windowEventHandler);
      window?.removeEventListener('load', this.#windowEventHandler);
      window?.removeEventListener('DOMContentLoaded', this.#windowEventHandler);
      this.removeEventListener('routelockprevented', handleRoutePrevented);
      this.removeEventListener('routeloadcompleted', handleRouteLoadCompleted);
    };
  };

  /**
   * Locks the router to the current route. Blocks navigation attempts handled *internally*
   * (e.g., `router.navigate()`, `<Link>` clicks, internal `popstate` events).
   *
   * **Limitation:** Does NOT prevent the user from leaving the page via browser actions
   * (external back/forward, close tab, new URL, refresh). Use `beforeunload` for those cases.
   *
   * The router will remain locked until `router.unlock()` is called. Attempts to navigate
   * while locked can be intercepted by listening to the `routelockprevented` event on the router.
   *
   * @example
   * router.lock();
   *
   * // Intercept navigation attempts while locked
   * router.addEventListener('routelockprevented', (event) => {
   *   console.log('Navigation prevented:', event.detail.attemptedPath);
   * });
   *
   * router.unlock();
   */
  lock() {
    this.#lock = this.#currentPath.get().fullPath;
  }

  /**
   * Unlocks the router, allowing navigation actions to be
   * processed again.
   *
   * @example
   * const router = useRouter()
   * router.unlock();
   */
  unlock() {
    this.#lock = null;
  }

  /** @param {RouterProviderProps} props */
  static asProvider(props) {
    const { router, children } = props;
    const value = {
      router,
      internalState: router.#internalState,
      depth: 0,
      metadata: new Map(),
    };
    return RouterScope.Provider({ value, children });
  }
}

// ----------
// FUNCTIONS
// ----------

/**
 * A hook that allows components to access the router instance from the nearest {@link RouterProvider}.
 *
 * This hook is typically used within components that need to programmatically navigate,
 * access current route information, or interact with the router's API.
 *
 * @example
 * ```tsx
 * import { useRouter } from 'retend/router';
 *
 * function MyComponent() {
 *   const router = useRouter();
 *
 *   const handleClick = () => {
 *     router.navigate('/dashboard');
 *   };
 *
 *   return <button onClick={handleClick}>Go to Dashboard</button>;
 * }
 * ```
 * @returns {Router} The router instance provided by the nearest `RouterProvider`.
 * @throws {Error} If `useRouter` is called outside of a `RouterProvider`.
 */
export function useRouter() {
  const { router } = useScopeContext(RouterScope);
  return router;
}

/**
 * A hook that returns a reactive {@link Cell} containing the current route data.
 *
 * This hook provides access to the active route's properties.
 * The returned `Cell` will automatically update whenever the current
 * route changes, allowing components to react to navigation.
 *
 * @returns {Cell<RouteData>} A reactive Cell containing the current route data.
 * @throws {Error} If `useCurrentRoute` is called outside of a `RouterProvider`.
 */
export function useCurrentRoute() {
  const { router } = useScopeContext(RouterScope);
  return router.getCurrentRoute();
}

/**
 * Provides the router instance to the component tree.
 *
 * This component should wrap your application's root component, making the router
 * instance accessible to all descendant components via the {@link useRouter} hook.
 *
 * @param {RouterProviderProps} props - The component props.
 * @returns {JSX.Template} The children rendered within the router's scope.
 *
 * @example
 * ```tsx
 * import { createWebRouter, RouterProvider } from 'retend/router';
 *
 * // Create and configure your router instance
 * const router = createWebRouter({
 *   routes: [
 *     { path: '/', component: Home },
 *     { path: '/about', component: About },
 *   ],
 * });
 *
 * function App() {
 *   return (
 *     <RouterProvider router={router}>
 *       {() => <router.Outlet />}
 *     </RouterProvider>
 *   );
 * }
 * ```
 */
export function RouterProvider(props) {
  return Router.asProvider(props);
}

/**
 * Creates a new web-based router instance with the provided route configurations.
 *
 * @param {RouterOptions} routerOptions - The options object for configuring the router.
 * @returns {Router} The created router instance.
 */
export function createWebRouter(routerOptions) {
  const router = new Router(routerOptions);
  return router;
}

/**
 * Defines an element that serves as the router outlet, rendering the component
 * associated with the current route.
 *
 * This component is used internally by the {@link Router} class to handle route changes and
 * render the appropriate component.
 * @param {RouterOutletProps} [props]
 * @returns {JSX.Template} The rendered custom element that serves as the router outlet.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Outlet />
 * ```
 */
export function Outlet(props) {
  const routerData = useScopeContext(RouterScope);
  const { depth, internalState } = routerData;
  const { children, ...attributes } = props || {};
  const currentLevel = Cell.derived(() => {
    return internalState.routeChain.get()[depth];
  });
  const path = Cell.derived(() => currentLevel.get()?.path);
  attributes['data-path'] = path;

  // @ts-expect-error: Children is not defined on attributes
  attributes.children = If(path, () => {
    const RenderFn = currentLevel.get().component;
    return RouterScope.Provider({
      value: { ...routerData, depth: routerData.depth + 1 },
      children: () => h(RenderFn, { metadata: internalState.metadata }),
    });
  });

  return h('retend-router-outlet', attributes);
}

/**
 * Defines an anchor element and handles click events to navigate to the specified route.
 *
 * @param {RouterLinkProps} [props] - The component props.
 * @returns {JSX.Template} The rendered anchor element.
 *
 * @example
 * ```tsx
 * // Basic navigation
 * <Link href="/about">About</Link>
 *
 * // With additional attributes
 * <Link href="/contact" class="button">
 *   Contact Us
 * </Link>
 * ```
 */
export function Link(props = {}) {
  const router = useRouter();
  const currentRoute = router.getCurrentRoute();
  if (!('href' in props)) {
    console.error('missing to attribute for link component.');
  }
  if ('active' in props) {
    console.error('active attribute is reserved for router.');
  }
  const { href: hrefProp, replace, children } = props;
  const href = Cell.derived(() => {
    return Cell.isCell(hrefProp) ? hrefProp.get() : hrefProp;
  });
  const active = Cell.derived(() => {
    const hrefValue = href.get();
    const { fullPath } = currentRoute.get();
    return Boolean(fullPath && hrefValue && fullPath.startsWith(hrefValue));
  });

  props.onClick = async (event) => {
    const anchor = /** @type {HTMLElement} */ (event.currentTarget);
    if (router.isNavigating) {
      event.preventDefault();
      return;
    }
    // Only navigate if the href is not a valid URL.
    // For valid URLs, the browser will handle the navigation.
    const hrefValue = href.get();
    if (hrefValue && !URL.canParse(hrefValue)) {
      event.preventDefault();
      const beforeEvent = new RouterNavigationEvent('beforenavigate', {
        detail: { href: hrefValue, replace },
        cancelable: true,
      });
      anchor.dispatchEvent(beforeEvent);
      if (beforeEvent.defaultPrevented) return;

      await router.navigate(hrefValue, { replace });

      const afterEvent = new RouterNavigationEvent('afternavigate', {
        detail: { href: hrefValue, replace },
      });
      anchor.dispatchEvent(afterEvent);
    }
  };
  // @ts-expect-error: active is not an external prop.
  props.active = active;

  return h('a', props, children);
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
 * Creates the root component for a router application.
 * This function wraps the main {@link Outlet} within a {@link RouterProvider},
 * making the router instance available to all child components via the {@link useRouter} hook.
 *
 * It's useful for setting up the top-level routing context of your application.
 *
 * @example
 * ```tsx
 * import { createWebRouter, createRouterRoot } from 'retend/router';
 * import { AppLayout } from './AppLayout';
 *
 * const router = createWebRouter({
 *   routes: [
 *     { path: '/', component: Home },
 *     { path: '/about', component: About },
 *   ],
 * });
 *
 * document.body.append(createRouterRoot(router));
 * ```
 *
 * @param {Router} router - The router instance to be provided to the application.
 * @returns {any} The root router component, typically an instance of `RouterProvider` wrapping an `Outlet`.
 */
export function createRouterRoot(router) {
  const rootOutlet = RouterProvider({ router, children: Outlet });
  if (Array.isArray(rootOutlet)) {
    const renderer = getActiveRenderer();
    const group = renderer.createGroup(rootOutlet);
    return group;
  }
  return rootOutlet;
}

// Type Re-exports
/** @typedef {RouterLinkProps} RouterLinkProps */
/** @typedef {RouterOutletProps} RouterOutletProps */
/** @typedef {RouteRecord} RouteRecord */
/** @typedef {RouteRecord[]} RouteRecords */
/** @typedef {RouterMiddleware} RouterMiddleware */
