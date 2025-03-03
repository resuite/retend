// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index' */

/**
 * @typedef {() => (Promise<{
 *  default: () => JSX.Template
 * }> | (() => JSX.Template))} LazyRouteLoader
 */

export class LazyRoute {
  /** @param {LazyRouteLoader} importer */
  constructor(importer) {
    this.importer = importer;
  }
}

/**
 * Creates a new `LazyRoute` instance that can be used to lazily load and render a component.
 *
 * @param {LazyRouteLoader} importer - A function that returns a Promise that resolves to the component to be rendered.
 * @returns {LazyRoute} A new `LazyRoute` instance.
 */
export function lazy(importer) {
  return new LazyRoute(importer);
}
