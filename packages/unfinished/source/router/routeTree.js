/** @import { JSX } from '../jsx-runtime/types.ts' */

/**
 * @typedef MetadataOptions
 * @property {Map<string, string>} params
 * @property {URLSearchParams} query
 */

/**
 * A set of key-value pairs that will become attributes on the meta tag.
 * @typedef {Record<string, any> | ((metadataOptions: MetadataOptions) => Record<string, any>)} Metadata
 */

/**
 * @typedef {Map<string, any>} MetadataMap
 */

/**
 * @template {Metadata} [M=Metadata]
 * @typedef {(() => JSX.Template) & { metadata?: M }} RouteComponent
 */

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
 * @property {Metadata} [metadata]
 * Metadata to be associated with the route.
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
 * @property {Metadata} [metadata]
 * Metadata to be associated with the route.
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
  /** @type {Metadata | null} */ metadata = {};

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
  /** @type {Metadata | null} */ metadata;

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
    this.metadata = route.metadata;
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
  /** @type {MetadataMap} */ metadata;

  /**
   * @param {Map<string, string>} params
   * @param {MatchedRoute<T> | null} subTree
   * @param {string} path
   * @param {URLSearchParams} searchQueryParams
   * @param {string | null} hash
   */
  constructor(params, subTree, path, searchQueryParams, hash) {
    this.params = params;
    this.subTree = subTree;
    this.path = path;
    this.hash = hash;
    this.searchQueryParams = searchQueryParams;
    this.metadata = this.collectMetadata();
  }

  /**
   * @private
   * Collects metadata from matched routes in hierarchical order.
   * @returns {MetadataMap}
   */
  collectMetadata() {
    const map = new Map();
    let current = this.subTree;
    while (current) {
      if (!current.metadata) {
        current = current.child;
        continue;
      }

      const metadataObject =
        typeof current.metadata === 'function'
          ? current.metadata({
              params: this.params,
              query: this.searchQueryParams,
            })
          : current.metadata;

      for (const [key, value] of Object.entries(metadataObject)) {
        map.set(key, value);
      }

      current = current.child;
    }
    return map;
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
   *
   * @param {string} path
   * @returns {MatchResult<T>}
   */
  match(path) {
    let searchQueryParams = new URLSearchParams();
    let hash = null;
    let pathname = path;
    try {
      const url = new URL(`http://localhost:8080${path}`);
      searchQueryParams = url.searchParams;
      pathname = url.pathname;
      hash = url.hash.slice(1);
    } catch (error) {
      console.warn(`Invalid path: ${path}`);
      console.error(error);
      return new MatchResult(new Map(), null, path, searchQueryParams, null);
    }

    for (const root of this.roots) {
      const params = new Map();
      const subtree = this.checkRoot(pathname, root, params);
      if (subtree) {
        return new MatchResult(params, subtree, path, searchQueryParams, hash);
      }
    }

    return new MatchResult(new Map(), null, path, searchQueryParams, hash);
  }

  /**
   * Checks if the given pathname matches the specified root node.
   * If it matches, returns the subtree under that root, otherwise returns null.
   *
   * @param {string} pathname - The pathname to match against
   * @param {Route<T>} root - The root node to check
   * @param {Map<string, string>} params - Map to store path parameters
   * @returns { MatchedRoute<T> |null} - The matching subtree or null if no match
   */
  checkRoot(pathname, root, params, index = 0) {
    const pathSegments = pathname.split('/').filter(Boolean);
    const rootSegments = root.path.split('/').filter(Boolean);

    let matchedIndex = index;
    let encounteredCatchAllWildcardAtParameter = '';
    while (matchedIndex < rootSegments.length) {
      const rootSegment = rootSegments[matchedIndex];
      const pathSegment = pathSegments[matchedIndex];

      // The target path is exhausted, but the root path is not.
      if (!pathSegment) {
        return null;
      }

      if (rootSegment === '*') {
        rootSegments[matchedIndex] = pathSegment;
        matchedIndex++;
        continue;
      }

      if (rootSegment.startsWith(':')) {
        let paramName = rootSegment.slice(1);

        if (paramName.endsWith('*')) {
          paramName = paramName.slice(0, -1);
          encounteredCatchAllWildcardAtParameter = paramName;
        }

        // Will prioritize previous parameter matches.
        const paramValue = params.get(paramName) ?? pathSegment;

        if (paramValue !== pathSegment) {
          return null;
        }

        params.set(paramName, paramValue);
        rootSegments[matchedIndex] = paramValue;
        matchedIndex++;
        continue;
      }

      // Mismatch in pathname: bail.
      if (rootSegment !== pathSegment) {
        return null;
      }

      matchedIndex++;
    }

    const matchedRoute = new MatchedRoute(root);

    // If the path is not exhausted, begin matching the remaining path segments
    // using the children of the current route.
    if (matchedIndex < pathSegments.length) {
      for (const child of root.children) {
        const childMatchedRoute = this.checkRoot(
          pathname,
          child,
          params,
          matchedIndex
        );
        if (childMatchedRoute) {
          matchedRoute.child = childMatchedRoute;
          break;
        }
      }

      if (matchedRoute.child === null) {
        if (root.children.length || !root.path.endsWith('*')) {
          return null;
        }

        if (encounteredCatchAllWildcardAtParameter) {
          params.set(
            encounteredCatchAllWildcardAtParameter,
            pathSegments.slice(matchedIndex - 1).join('/')
          );
        }
      }
    }

    return matchedRoute;
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

    const current = root;

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
    current.metadata = routeRecord.metadata ?? null;

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
