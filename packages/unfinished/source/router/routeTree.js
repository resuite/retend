/**
 * @template T
 * @typedef RouteRecordWithChildren
 * @property {string} name
 * The name of the route.
 * @property {string} path
 * The path pattern to match against the URL.
 * @property {string} [redirect]
 * The path to redirect to when the route is matched, if there is no component.
 * @property {string} [title]
 * The title to give the document when the route is matched.
 * if there are nested routes with a title set, the title will be overwritten.
 * @property {T} [component]
 * The component to render when the route is matched.
 * @property {RouteRecord<T>[]} children
 * An array of child routes.
 * @property {string} [transitionType]
 * The active view transition type for the route. This will be set on the document
 * whenever the route is being transitioned to.
 */

/**
 * @template T
 * @typedef RouteRecordWithComponent
 *
 * @property {string} name
 * The name of the route.
 *
 * @property {string} path
 * The path pattern to match against the URL.
 *
 * @property {string} [redirect]
 * The path to redirect to when the route is matched, if there is no component.
 *
 * @property {string} [title]
 * The title to give the document when the route is matched.
 * if there are nested routes with a title set, the title will be overwritten.
 *
 * @property {T} component
 * The component to render when the route is matched.
 *
 * @property {string} [transitionType]
 * The active view transition type for the route. This will be set on the document
 * whenever the route is being transitioned to.
 */

/**
 * @template T
 * @typedef {RouteRecordWithChildren<T> | RouteRecordWithComponent<T>} RouteRecord
 */

/**
 * @template T
 * @typedef {RouteRecord<T>[]} RouteRecords
 */

/** @template T */
export class Route {
  /** @type {string | null} */ name = null;
  /** @type {string | null} */ title = null;
  /** @type {string} */ path = '';
  /** @type {string | null} */ redirect = null;
  /** @type {T | null} */ component = null;
  /** @type {string | null} */ transitionType = null;
  /** @type {boolean} */ isActive = false;
  /** @type {boolean} */ isDynamic = false;
  /** @type {boolean} */ isWildcard = false;
  /** @type {boolean} */ isTransient = false;
  /** @type {Route<T>[]} */ children = [];

  /**
   * Creates a new Route instance with the specified path.
   *
   * @param {string} fullPath - The path to assign to the route.
   */
  constructor(fullPath) {
    this.path = fullPath;
  }
}

/** @template T */
export class MatchedRoute {
  /** @type {string | null} */ name;
  /** @type {string} */ path;
  /** @type {string | null} */ redirect;
  /** @type {string | null} */ title;
  /** @type {T | null} */ component;
  /** @type {boolean} */ isDynamic;
  /** @type {boolean} */ isTransient;
  /** @type {MatchedRoute<T> | null} */ child;
  /** @type {string | null} */ transitionType;

  /**
   * @param {Route<T>} route
   */
  constructor(route) {
    this.path = route.path;
    this.name = route.name;
    this.component = route.component;
    this.isDynamic = route.isDynamic;
    this.redirect = route.redirect;
    this.isTransient = route.isTransient;
    this.child = null;
    this.title = route.title;
    this.transitionType = route.transitionType;
  }
}

/**
 * @template T
 */
export class MatchResult {
  /** @type {string} */ path;
  /** @type {URLSearchParams} */ searchQueryParams;
  /** @type {Map<string, string>} */ params;
  /** @type {MatchedRoute<T> | null} */ subTree;

  /**
   * @param {Map<string, string>} params
   * @param {MatchedRoute<T> | null} subTree
   * @param {string} path
   * @param {URLSearchParams} searchQueryParams
   */
  constructor(params, subTree, path, searchQueryParams) {
    this.params = params;
    this.subTree = subTree;
    this.path = path;
    this.searchQueryParams = searchQueryParams;
  }

  /**
   * This method removes any intermediate transient routes from the current match result's subtree.
   * It traverses the subtree and skips over any transient routes, effectively flattening the subtree
   * by directly linking non-transient routes to their respective child routes.
   *
   * After calling this method, the `subTree` property will point to the first non-transient route in the subtree,
   * and any remaining transient routes will be skipped over.
   */
  flattenTransientRoutes() {
    while (this.subTree?.isTransient) {
      this.subTree = this.subTree.child;
    }

    let current = this.subTree;
    while (current?.child?.isTransient) {
      current.child = current.child.child;
      current = current.child;
    }
  }

  /**
   * Traverses the `subTree` property and returns the last non-null `child` node, effectively returning the leaf node of the subtree.
   * @returns {MatchedRoute<T> | null} The leaf node of the subtree, or `null` if the subtree is empty.
   */
  leaf() {
    let current = this.subTree;
    while (current?.child) {
      current = current.child;
    }
    return current;
  }
}

/** @template T */
export class RouteTree {
  /** @type {Route<T>[]} */
  roots = [];

  /**
   * @private
   * @type {Map<string, string>}
   */
  parameterMap = new Map();

  /**
   *
   * @param {string} path
   * @returns {MatchResult<T>}
   */
  match(path) {
    let searchQueryParams = new URLSearchParams();
    let pathname = path;
    try {
      const url = new URL(`http://localhost:8080${path}`);
      searchQueryParams = url.searchParams;
      pathname = url.pathname;
    } catch (error) {
      console.warn(`Invalid path: ${path}`);
      console.error(error);
      return new MatchResult(new Map(), null, path, searchQueryParams);
    }

    for (const root of this.roots) {
      if (this.selectActiveRoutes(pathname, root)) {
        break;
      }
    }

    const subTree = this.retrieveActiveSubtree(this.roots);
    const params = this.parameterMap;
    this.parameterMap = new Map();
    for (const root of this.roots) {
      this.deactivateRoute(root);
    }
    return new MatchResult(params, subTree, path, searchQueryParams);
  }

  /**
   * Recursively selects the active routes based on the given path and root route.
   *
   * @param {string} path - The path to match against the routes.
   * @param {Route<T>} root - The root route to start the selection from.
   * @returns {boolean} - `true` if the path matches the root route or one of its children, `false` otherwise.
   */
  selectActiveRoutes(path, root) {
    let rootFullPath = root.path;

    for (const [key, value] of this.parameterMap) {
      if (value) {
        rootFullPath = rootFullPath.replace(`:${key}`, value);
      }
    }

    // Temporary variables used to store the
    // rewritten parameter name and value during the dynamic route matching process,
    // in case the dynamic route ends up failing.
    let rewrittenParamName;
    let rewrittenParamValue;

    const rootSegments = rootFullPath.split('/');
    const targetPathSegments = path.split('/');
    for (const [index, segment] of rootSegments
      .slice(0, targetPathSegments.length)
      .entries()) {
      if (segment === '*') {
        rootSegments[index] = targetPathSegments[index];
      }
    }
    rootFullPath = rootSegments.join('/');

    if (path.startsWith(rootFullPath)) {
      const subPath = path.slice(rootFullPath.length);
      if (subPath.length === 0 && !root.isTransient) {
        root.isActive = true;
        // match any fallthrough routes
        for (const child of root.children) {
          if (
            root.path === child.path &&
            this.selectActiveRoutes(path, child)
          ) {
            break;
          }
        }
        return true;
      }

      for (const child of root.children) {
        if (this.selectActiveRoutes(path, child)) {
          root.isActive = true;
          return true;
        }
      }
    } else if (root.isDynamic) {
      const rootPathSegments = rootFullPath.split('/').filter(Boolean);
      const targetPathSegments = path.split('/').filter(Boolean);

      const previousRootSegments = rootPathSegments.slice(0, -1);
      const previousTargetSegments = targetPathSegments.slice(
        0,
        previousRootSegments.length - 2
      );

      const dynamicPathMatched = previousTargetSegments
        .join('/')
        .startsWith(previousRootSegments.join('/'));

      if (!dynamicPathMatched) {
        this.deactivateRoute(root);
        return false;
      }

      const targetIndex = rootPathSegments.length - 1;
      rewrittenParamName = rootPathSegments[targetIndex].slice(1);
      rewrittenParamValue = this.parameterMap.get(rewrittenParamName);
      this.parameterMap.set(
        rewrittenParamName,
        targetPathSegments[targetIndex]
      );

      if (
        previousTargetSegments.length === previousRootSegments.length &&
        !root.isTransient
      ) {
        root.isActive = true;
        return true;
      }

      for (const child of root.children) {
        if (this.selectActiveRoutes(path, child)) {
          root.isActive = true;
          return true;
        }
      }
    } else if (root.isWildcard) {
      root.isActive = true;
      return true;
    }

    if (rewrittenParamName) {
      if (rewrittenParamValue) {
        this.parameterMap.set(rewrittenParamName, rewrittenParamValue);
      } else {
        this.parameterMap.delete(rewrittenParamName);
      }
    }

    if (root.isWildcard && root.path.endsWith('*') && !root.isTransient) {
      root.isActive = true;
      return true;
    }

    this.deactivateRoute(root);
    return false;
  }

  /**
   * Retrieves the active root route from the route tree.
   * @param {Route<T>[]} roots
   * @returns { MatchedRoute<T> | null} The active root route, or null if no root route is active.
   */
  retrieveActiveSubtree(roots) {
    for (const root of roots) {
      if (root.isActive) {
        const activeRoot = new MatchedRoute(root);
        const activeChildRoots = this.retrieveActiveSubtree(root.children);
        activeRoot.child = activeChildRoots;

        return activeRoot;
      }
    }
    return null;
  }

  /**
   * Deactivates the specified route and all of its child routes.
   *
   * @param {Route<T>} route - The route to deactivate.
   */
  deactivateRoute(route) {
    route.isActive = false;
    for (const child of route.children) {
      this.deactivateRoute(child);
    }
  }

  toString() {
    return JSON.stringify(this, null, 2);
  }
}

/**
 * @type {WeakMap<object, Route<any>[]>}
 * A weakmap that matches a route component to its corresponding route record.
 * It allows me to surgically change the component function of a route when changing
 * functions in HMR.
 */
export const routeToComponent = new WeakMap();

/**
 * @template T
 * Constructs a new `RouteTree` instance from an array of route records.
 *
 * @param {RouteRecord<T>[]} routeRecords - An array of route records to construct the route tree from.
 * @param {Route<T> | null} [parent] - The parent route record.
 * @returns {RouteTree<T>} A new `RouteTree` instance constructed from the provided route records.
 */
RouteTree.fromRouteRecords = (routeRecords, parent = null) => {
  const tree = new RouteTree();
  const parentFullPath = parent ? parent.path : '/';

  for (const routeRecord of routeRecords) {
    const path = routeRecord.path.replace(/\/+/g, '/');
    const pathSegments = path.split('/').filter(Boolean);
    const subPath = `${parentFullPath}/${pathSegments[0] ?? '/'}`;
    const root = new Route(subPath.replace(/\/+/g, '/'));

    let current = root;

    if (pathSegments.length > 1) {
      for (const [index, pathSegment] of pathSegments.slice(1).entries()) {
        const subPath = `${parentFullPath}/${pathSegments
          .slice(1, index)
          .join('/')}/${pathSegment}`;
        const child = new Route(subPath.replace(/\/+/g, '/'));

        child.isDynamic = pathSegment.startsWith(':');
        child.isWildcard = pathSegment.startsWith('*');
        current.isTransient = true;

        current.children.push(child);
        current = child;
      }
    }

    current.name = routeRecord.name ?? null;
    const component = routeRecord.component;
    current.component = component;

    if (
      (typeof component === 'object' || typeof component === 'function') &&
      component !== null
    ) {
      const match = routeToComponent.get(component) ?? [];
      match.push(current);
      routeToComponent.set(component, match);
    }
    current.redirect = routeRecord.redirect ?? null;
    current.title = routeRecord.title ?? null;
    current.transitionType = routeRecord.transitionType ?? null;

    const fullPath = `${parentFullPath}/${routeRecord.path}`;
    current.path = fullPath.replace(/\/+/g, '/');

    if (pathSegments.length <= 1) {
      current.isDynamic = routeRecord.path.startsWith(':');
      current.isWildcard = routeRecord.path.startsWith('*');
    }

    current.children =
      'children' in routeRecord
        ? RouteTree.fromRouteRecords(routeRecord.children, current).roots
        : [];

    tree.roots.push(root);
  }
  return tree;
};
