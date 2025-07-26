/**
 * @template out LazyContent
 * @typedef {() => (Promise<{ default: LazyContent }> | LazyContent)} LazyLoader
 */

/** @template LazyContent */
export class Lazy {
  /** @param {LazyLoader<LazyContent>} importer */
  constructor(importer) {
    this.importer = importer;
  }

  async unwrap() {
    const imported = this.importer();
    if (imported instanceof Promise) {
      return (await imported).default;
    } else {
      return imported;
    }
  }
}

/**
 * @template T
 * Creates a new `Lazy` instance that can be used to lazily load and render resources.
 *
 * @param {LazyLoader<T>} importer - A function that returns a Promise that resolves to the whatever is to be loaded.
 * @returns {Lazy<T>} A new `Lazy` instance.
 */
export function lazy(importer) {
  return new Lazy(importer);
}
