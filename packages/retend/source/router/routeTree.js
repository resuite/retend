/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { Lazy } from "./lazy.js"; */

/**
 * @typedef MetadataOptions
 * @property {Map<string, string>} params
 * @property {URLSearchParams} query
 */

/**
 * A set of key-value pairs that will become attributes on the meta tag.
 * @typedef {Record<string, any> | ((metadataOptions: MetadataOptions) => Promise<Record<string, any>> | Record<string, any>)} Metadata
 */

/**
 * @typedef {Map<string, any>} MetadataMap
 */

/**
 * @template {Metadata} [M=Metadata]
 * @typedef {(() => JSX.Template) & { metadata?: M | ((metadataOptions: MetadataOptions) => Promise<M> | M) }} RouteComponent
 */

/**
 * @template T
 * @typedef RouteRecordBase
 *
 * @property {string} path
 * The path pattern to match against the URL.
 */

/**
 * @template T
 * @typedef EagerRouteRecordBase
 *
 * @property {string} [name]
 * The name of the route.
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
 * @property {string} [transitionType]
 * The active view transition type for the route. This will be set on the document
 * whenever the route is being transitioned to.
 */

/**
 * @template T
 * @typedef {EagerRouteRecordBase<T> & RouteRecordBase<T>} EagerRouteRecord
 */

/**
 * @template T
 * @typedef RouteRecordWithChildrenBase
 *
 * @property {T} [component]
 * The component to render when the route is matched.
 *
 * @property {RouteRecord<T>[]} children
 * An array of child routes.
 */

/**
 * @template T
 * @typedef {EagerRouteRecord<T> & RouteRecordWithChildrenBase<T>} RouteRecordWithChildren
 */

/**
 * @template T
 * @typedef RouteRecordWithComponentBase
 * @property {T} component
 * The component to render when the route is matched.
 */

/**
 * @template T
 * @typedef {EagerRouteRecord<T> & RouteRecordWithComponentBase<T>} RouteRecordWithComponent
 */

/**
 * @template T
 * @typedef RouteRecordWithLazySubtreeBase
 *
 * @property {Lazy<RouteRecord<T>>} subtree
 * The lazy-loaded route record for a subtree of routes. Used to enable code splitting for routes.
 * When a route with a lazy subtree is matched, the subtree is loaded asynchronously.
 */

/**
 * @template T
 * @typedef {RouteRecordWithLazySubtreeBase<T> & RouteRecordBase<T>} RouteRecordWithLazySubtree
 */

/**
 * @template T
 * @typedef {RouteRecordWithChildren<T> | RouteRecordWithComponent<T> | RouteRecordWithLazySubtree<T>} RouteRecord
 */

/**
 * @template T
 * @typedef {RouteRecord<T>[]} RouteRecords
 */

export class Route {
  /**
   * Creates a new Route instance with the specified path.
   * @param {string} path - The path to assign to the route.
   */
  constructor(path) {
    this.path = path;
  }
}

/** @template T */
export class EagerRoute extends Route {
  /** @type {string | null} */ name = null;
  /** @type {string | null} */ title = null;
  /** @type {string | null} */ redirect = null;
  /** @type {T | null} */ component = null;
  /** @type {string | null} */ transitionType = null;
  /** @type {boolean} */ isActive = false;
  /** @type {boolean} */ isDynamic = false;
  /** @type {boolean} */ isWildcard = false;
  /** @type {boolean} */ isTransient = false;
  /** @type {(EagerRoute<T> | LazyRoute<T>)[]} */ children = [];
  /** @type {Metadata | null} */ metadata = {};

  /**
   * @param {string} path - The path to assign to the route.
   */
  constructor(path) {
    super(path);
  }
}

/** @template T */
export class LazyRoute extends Route {
  /**
   * @param {string} path
   * @param {Lazy<RouteRecord<T>>} subtree
   */
  constructor(path, subtree) {
    super(path);
    this.subtree = subtree;
  }

  /**
   * @param {EagerRoute<T>} [parent]
   * @returns {Promise<EagerRoute<T>>}
   */
  async unroll(parent) {
    let record = await this.subtree.unwrap();
    while ('subtree' in record) {
      record = await record.subtree.unwrap();
    }
    const roots = RouteTree.fromRouteRecords([record], parent).roots;

    while (roots[0] instanceof EagerRoute && roots[0].isTransient) {
      roots[0] = roots[0].children[0];
    }

    if (roots.length !== 1) {
      const message = 'Invalid lazy route subtree.';
      throw new Error(message);
    }
    if (roots[0] instanceof LazyRoute) {
      return roots[0].unroll(parent);
    }

    let eagerRoute = roots[0];
    if (eagerRoute.path !== this.path) {
      const message = `Lazy subtrees must have the same path as their parents. Parent path: ${this.path}, Subtree path: ${eagerRoute.path}`;
      throw new Error(message);
    }

    return eagerRoute;
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
   * @param {EagerRoute<T>} route
   */
  constructor(route) {
    this.path = route.path || '/';
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
    this.metadata = new Map();
  }

  /**
   * Collects metadata from matched routes in hierarchical order.
   */
  async collectMetadata() {
    let current = this.subTree;
    while (current) {
      if (
        !(
          current.metadata ||
          (current.component &&
            typeof current.component === 'function' &&
            'metadata' in current.component)
        )
      ) {
        current = current.child;
        continue;
      }

      const metadataObject = current.metadata
        ? typeof current.metadata === 'function'
          ? await current.metadata({
              params: this.params,
              query: this.searchQueryParams,
            })
          : current.metadata
        : null;

      const embeddedMetadata =
        typeof current.component === 'function' &&
        'metadata' in current.component
          ? typeof current.component.metadata === 'function'
            ? await current.component.metadata({
                params: this.params,
                query: this.searchQueryParams,
              })
            : current.component.metadata
          : null;

      if (metadataObject) {
        for (const [key, value] of Object.entries(metadataObject)) {
          this.metadata.set(key, value);
        }
      }

      if (embeddedMetadata) {
        for (const [key, value] of Object.entries(embeddedMetadata)) {
          this.metadata.set(key, value);
        }
      }

      current = current.child;
    }
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
    while (
      this.subTree &&
      (this.subTree.isTransient || !this.subTree?.component)
    ) {
      this.subTree = this.subTree.child;
    }

    let current = this.subTree;
    while (current?.child) {
      if (current?.child?.isTransient || !current.child?.component) {
        current.child = current.child.child;
        current = current.child;
      }
    }
    this.subTree = current ?? this.subTree;
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
  /** @type {(LazyRoute<T> | EagerRoute<T>)[]} */
  roots = [];

  /**
   * Selects a section of the route tree that matches a given path.
   * @param {string} path
   * @returns {Promise<MatchResult<T>>}
   */
  async match(path) {
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
      const subtree = await this.checkRoot(pathname, root, params);
      if (subtree) {
        const matchResult = new MatchResult(
          params,
          subtree,
          path,
          searchQueryParams,
          hash
        );
        await matchResult.collectMetadata();
        return matchResult;
      }
    }

    return new MatchResult(new Map(), null, path, searchQueryParams, hash);
  }

  /**
   * @param {EagerRoute<T> | LazyRoute<T>} route
   * @param {EagerRoute<T>} [parent]
   */
  async flattenRoute(route, parent) {
    const resolved =
      route instanceof LazyRoute ? await route.unroll(parent) : route;
    // Fills out the route tree with eager routes for faster subsequent loads.
    if (resolved !== route) {
      // only scenario where a route has no parents is if its at the root level.
      const children = parent?.children ?? this.roots;
      children.splice(children.indexOf(route), 1, resolved);
    }
    return resolved;
  }

  /**
   * Checks if the given pathname matches the specified root node.
   * If it matches, returns the subtree under that root, otherwise returns null.
   *
   * @param {string} pathname - The pathname to match against
   * @param {LazyRoute<T> | EagerRoute<T>} root - The root node to check
   * @param {Map<string, string>} params - Map to store path parameters
   * @param {EagerRoute<T>} [parent] Parent route for lazy route replacement.
   * @returns {Promise<MatchedRoute<T> |null>} - The matching subtree or null if no match
   */
  async checkRoot(pathname, root, params, parent) {
    const pathSegments = pathname.split('/').filter(Boolean);
    const rootSegments = root.path.split('/').filter(Boolean);

    // Matches fallthrough to children if the root path is empty
    if (root.path === parent?.path || rootSegments.length == 0) {
      const resolved = await this.flattenRoute(root, parent);
      const matchedRoute = new MatchedRoute(resolved);
      for (const child of resolved.children) {
        const childMatchedRoute = await this.checkRoot(
          pathname,
          child,
          params,
          resolved
        );
        if (childMatchedRoute) {
          matchedRoute.child = childMatchedRoute;
          break;
        }
      }
      if (matchedRoute.child !== null) {
        return matchedRoute;
      }
    }

    let i = 0;
    let encounteredCatchAllWildcardAtParameter = '';
    while (i < rootSegments.length) {
      const rootSegment = rootSegments[i];
      const pathSegment = pathSegments[i];

      // The target path is exhausted, but the root path is not.
      if (!pathSegment) {
        return null;
      }

      if (rootSegment === '*') {
        rootSegments[i] = pathSegment;
        i++;
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
        rootSegments[i] = paramValue;
        i++;
        continue;
      }

      // Mismatch in pathname: bail.
      if (rootSegment !== pathSegment) {
        return null;
      }

      i++;
    }

    const resolved = await this.flattenRoute(root, parent);
    const matchedRoute = new MatchedRoute(resolved);

    // If the path is not exhausted, begin matching the remaining path segments
    // using the children of the current route.
    // Also do this it the path is exhausted, but there is no component/child match
    const continueMatching =
      i < pathSegments.length ||
      !(matchedRoute.child || matchedRoute.component) ||
      resolved.children.some((child) => child.path == resolved.path);

    if (continueMatching) {
      const parent = resolved;
      for (const child of parent.children) {
        const childMatchedRoute = await this.checkRoot(
          pathname,
          child,
          params,
          parent
        );
        if (childMatchedRoute) {
          matchedRoute.child = childMatchedRoute;
          break;
        }
      }

      if (matchedRoute.child === null) {
        if (resolved.children.length || !resolved.path.endsWith('*')) {
          return null;
        }

        if (encounteredCatchAllWildcardAtParameter) {
          params.set(
            encounteredCatchAllWildcardAtParameter,
            pathSegments.slice(i - 1).join('/')
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
 * @type {WeakMap<object, EagerRoute<any>[]>}
 * A weakmap that matches a route component to its corresponding route record.
 * It allows me to surgically change the component function of a route when changing
 * functions in HMR.
 */
export const routeToComponent = new WeakMap();

/**
 *
 * Creates a route subtree that is just nested transient routes, if any.
 *
 * @template T
 * @template {Lazy<RouteRecord<T>> | undefined} L
 * @param {string[]} pathSegments
 * @param {string[]} parentPathSegments
 * @param {L} lazySubtree
 * @returns {{ root: EagerRoute<T> | LazyRoute<T>, leaf: EagerRoute<T> | LazyRoute<T> }}
 */
function createTransientTree(pathSegments, parentPathSegments, lazySubtree) {
  let root;
  let buildingPath = '/' + parentPathSegments.join('/');
  if (pathSegments[0]) {
    buildingPath += parentPathSegments.length
      ? `/${pathSegments[0]}`
      : pathSegments[0];
  }

  if (lazySubtree && pathSegments.length <= 1) {
    root = new LazyRoute(buildingPath, lazySubtree);
    return { root, leaf: root };
  }

  root = new EagerRoute(buildingPath);
  root.isTransient = pathSegments.length > 1;
  root.isDynamic = pathSegments[0]?.startsWith(':');
  root.isWildcard = pathSegments[0]?.startsWith('*');

  let current = root;
  let idx = 1;

  while (pathSegments[idx]) {
    const segment = pathSegments[idx];
    buildingPath += `/${segment}`;

    const parent = current;
    if (idx === pathSegments.length - 1 && lazySubtree) {
      // @ts-expect-error: I gave up.
      current = new LazyRoute(buildingPath, lazySubtree);
    } else {
      current = new EagerRoute(buildingPath);
      current.isDynamic = segment.startsWith(':');
      current.isWildcard = segment.startsWith('*');
      current.isTransient = idx !== pathSegments.length - 1;
    }
    parent.children.push(current);
    idx++;
  }

  return { root, leaf: current };
}

/**
 * @template T
 * Constructs a new `RouteTree` instance from an array of route records.
 *
 * @param {RouteRecord<T>[]} routeRecords - An array of route records to construct the route tree from.
 * @param {EagerRoute<T> | null} [parent] - The parent route record.
 * @returns {RouteTree<T>} A new `RouteTree` instance constructed from the provided route records.
 */
RouteTree.fromRouteRecords = (routeRecords, parent = null) => {
  const tree = new RouteTree();
  const parentPathSegments = parent?.path.split('/').filter(Boolean) || [];

  if (parent?.isTransient) {
    parentPathSegments.pop();
  }

  for (const routeRecord of routeRecords) {
    const path = routeRecord.path.replace(/\/+/g, '/');
    const pathSegments = path.split('/').filter(Boolean);

    const { root, leaf } = createTransientTree(
      pathSegments,
      parentPathSegments,
      'subtree' in routeRecord ? routeRecord.subtree : undefined
    );
    if (leaf instanceof EagerRoute && !('subtree' in routeRecord)) {
      leaf.name = routeRecord.name ?? null;
      const component = routeRecord.component;
      leaf.component = component;

      if (
        (typeof component === 'object' || typeof component === 'function') &&
        component !== null
      ) {
        const match = routeToComponent.get(component) ?? [];
        match.push(leaf);
        routeToComponent.set(component, match);
      }
      if (routeRecord.redirect) {
        leaf.redirect = routeRecord.redirect;
      }
      if (routeRecord.title) {
        leaf.title = routeRecord.title;
      }
      if (routeRecord.transitionType) {
        leaf.transitionType = routeRecord.transitionType;
      }
      if (routeRecord.metadata) {
        leaf.metadata = routeRecord.metadata;
      }

      if (pathSegments.length <= 1) {
        leaf.isDynamic = routeRecord.path.startsWith(':');
        leaf.isWildcard = routeRecord.path.startsWith('*');
      }

      leaf.children =
        'children' in routeRecord
          ? RouteTree.fromRouteRecords(routeRecord.children, leaf).roots
          : [];
    }
    tree.roots.push(root);
  }

  return tree;
};
