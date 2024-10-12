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
 */
/**
 * @template T
 * @typedef RouteRecordWithComponent
 * @property {string} name
 * The name of the route.
 * @property {string} path
 * The path pattern to match against the URL.
 * @property {string} [redirect]
 * The path to redirect to when the route is matched, if there is no component.
 * @property {string} [title]
 * The title to give the document when the route is matched.
 * if there are nested routes with a title set, the title will be overwritten.
 * @property {T} component
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
export class Route<T> {
    /**
     * Creates a new Route instance with the specified path.
     *
     * @param {string} fullPath - The path to assign to the route.
     */
    constructor(fullPath: string);
    /** @type {string | null} */ name: string | null;
    /** @type {string | null} */ title: string | null;
    /** @type {string} */ fullPath: string;
    /** @type {string | null} */ redirect: string | null;
    /** @type {T | null} */ component: T | null;
    /** @type {boolean} */ isActive: boolean;
    /** @type {boolean} */ isDynamic: boolean;
    /** @type {boolean} */ isWildcard: boolean;
    /** @type {boolean} */ isTransient: boolean;
    /** @type {Route<T>[]} */ children: Route<T>[];
}
/** @template T */
export class MatchedRoute<T> {
    /**
     * @param {Route<T>} route
     */
    constructor(route: Route<T>);
    /** @type {string | null} */ name: string | null;
    /** @type {string} */ fullPath: string;
    /** @type {string | null} */ redirect: string | null;
    /** @type {string | null} */ title: string | null;
    /** @type {T | null} */ component: T | null;
    /** @type {boolean} */ isDynamic: boolean;
    /** @type {boolean} */ isTransient: boolean;
    /** @type {MatchedRoute<T> | null} */ child: MatchedRoute<T> | null;
}
/**
 * @template T
 */
export class MatchResult<T> {
    /**
     * @param {Map<string, string>} params
     * @param {MatchedRoute<T> | null} subTree
     * @param {string} path
     * @param {URLSearchParams} searchQueryParams
     */
    constructor(params: Map<string, string>, subTree: MatchedRoute<T> | null, path: string, searchQueryParams: URLSearchParams);
    /** @type {string} */ path: string;
    /** @type {URLSearchParams} */ searchQueryParams: URLSearchParams;
    /** @type {Map<string, string>} */ params: Map<string, string>;
    /** @type {MatchedRoute<T> | null} */ subTree: MatchedRoute<T> | null;
    /**
     * This method removes any intermediate transient routes from the current match result's subtree.
     * It traverses the subtree and skips over any transient routes, effectively flattening the subtree
     * by directly linking non-transient routes to their respective child routes.
     *
     * After calling this method, the `subTree` property will point to the first non-transient route in the subtree,
     * and any remaining transient routes will be skipped over.
     */
    flattenTransientRoutes(): void;
    /**
     * Traverses the `subTree` property and returns the last non-null `child` node, effectively returning the leaf node of the subtree.
     * @returns {MatchedRoute<T> | null} The leaf node of the subtree, or `null` if the subtree is empty.
     */
    leaf(): MatchedRoute<T> | null;
}
/** @template T */
export class RouteTree<T> {
    /** @type {Route<T>[]} */
    roots: Route<T>[];
    /**
     * @private
     * @type {Map<string, string>}
     */
    private parameterMap;
    /**
     *
     * @param {string} path
     * @returns {MatchResult<T>}
     */
    match(path: string): MatchResult<T>;
    /**
     * Recursively selects the active routes based on the given path and root route.
     *
     * @param {string} path - The path to match against the routes.
     * @param {Route<T>} root - The root route to start the selection from.
     * @returns {boolean} - `true` if the path matches the root route or one of its children, `false` otherwise.
     */
    selectActiveRoutes(path: string, root: Route<T>): boolean;
    /**
     * Retrieves the active root route from the route tree.
     * @param {Route<T>[]} roots
     * @returns { MatchedRoute<T> | null} The active root route, or null if no root route is active.
     */
    retrieveActiveSubtree(roots: Route<T>[]): MatchedRoute<T> | null;
    /**
     * Deactivates the specified route and all of its child routes.
     *
     * @param {Route<T>} route - The route to deactivate.
     */
    deactivateRoute(route: Route<T>): void;
    toString(): string;
}
export namespace RouteTree {
    /**
     * @template T
     * Constructs a new `RouteTree` instance from an array of route records.
     *
     * @param {RouteRecord<T>[]} routeRecords - An array of route records to construct the route tree from.
     * @param {Route<T> | null} [parent] - The parent route record.
     * @returns {RouteTree<T>} A new `RouteTree` instance constructed from the provided route records.
     */
    function fromRouteRecords<T_1>(routeRecords: RouteRecord<T_1>[], parent?: Route<T_1> | null | undefined): RouteTree<T_1>;
}
export type RouteRecordWithChildren<T> = {
    /**
     * The name of the route.
     */
    name: string;
    /**
     * The path pattern to match against the URL.
     */
    path: string;
    /**
     * The path to redirect to when the route is matched, if there is no component.
     */
    redirect?: string | undefined;
    /**
     * The title to give the document when the route is matched.
     * if there are nested routes with a title set, the title will be overwritten.
     */
    title?: string | undefined;
    /**
     * The component to render when the route is matched.
     */
    component?: T | undefined;
    /**
     * An array of child routes.
     */
    children: RouteRecord<T>[];
};
export type RouteRecordWithComponent<T> = {
    /**
     * The name of the route.
     */
    name: string;
    /**
     * The path pattern to match against the URL.
     */
    path: string;
    /**
     * The path to redirect to when the route is matched, if there is no component.
     */
    redirect?: string | undefined;
    /**
     * The title to give the document when the route is matched.
     * if there are nested routes with a title set, the title will be overwritten.
     */
    title?: string | undefined;
    component: T;
};
export type RouteRecord<T> = RouteRecordWithChildren<T> | RouteRecordWithComponent<T>;
export type RouteRecords<T> = RouteRecord<T>[];
