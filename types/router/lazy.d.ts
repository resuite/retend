/**
 * Creates a new `LazyRoute` instance that can be used to lazily load and render a component.
 *
 * @param {LazyRouteLoader} importer - A function that returns a Promise that resolves to the component to be rendered.
 * @returns {LazyRoute} A new `LazyRoute` instance.
 */
export function lazy(importer: LazyRouteLoader): LazyRoute;
/**
 * @typedef {() => (Promise<{
 *  default: () => JSX.Template
 * }> | (() => JSX.Template))} LazyRouteLoader
 */
export class LazyRoute {
    /** @param {LazyRouteLoader} importer */
    constructor(importer: LazyRouteLoader);
    importer: LazyRouteLoader;
}
export type LazyRouteLoader = () => (Promise<{
    default: () => JSX.Template;
}> | (() => JSX.Template));
