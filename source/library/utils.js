import { Cell } from '@adbl/cells';

/**
 * A {@link Map} implementation that automatically removes the oldest entry when the maximum size is reached.
 * @template K, V
 * @extends {Map<K, V>}
 */
export class FixedSizeMap extends Map {
  /** @private @type {K[]} */ keyOrder;
  /** @private @type {number} */ maxSize;

  /**
   * Creates a new FixedSizeMap with specified maximum size
   * @param {number} maxSize - Maximum number of entries the map can hold
   * @param {[K, V][]} [entries] - Initial entries for the map
   */
  constructor(maxSize, entries) {
    super(entries);
    this.maxSize = maxSize;
    this.keyOrder = Array.from(this.keys());
  }

  /**
   * Sets a new key-value pair, removing oldest entry if map is full
   * @param {K} key - The key to set
   * @param {V} value - The value to set
   * @returns {this} The map object
   */
  set(key, value) {
    if (this.size >= this.maxSize && !this.has(key)) {
      const oldestKey = this.keyOrder.shift();
      if (!oldestKey) return this;
      super.delete(oldestKey);
    }

    super.set(key, value);

    if (!this.keyOrder.includes(key)) {
      this.keyOrder.push(key);
    }

    return this;
  }

  /**
   * Deletes an entry from the map
   * @param {K} key - The key to delete
   * @returns {boolean} True if the element was removed
   */
  delete(key) {
    const deleted = super.delete(key);
    if (deleted) {
      this.keyOrder = this.keyOrder.filter((k) => k !== key);
    }
    return deleted;
  }

  /**
   * Removes all entries from the map
   */
  clear() {
    super.clear();
    this.keyOrder = [];
  }
}

/**
 * Converts an object of styles to a CSS stylesheet string.
 *
 * @param {Partial<CSSStyleDeclaration>} styles - An object where the keys are CSS property names and the values are CSS property values.
 * @param {boolean} [useHost] - Whether to include the `:host` selector in the stylesheet.
 * @param {any} [element] The target element, if any.
 * @returns {string} A CSS stylesheet string that can be applied as a style to an HTML element.
 */
export function convertObjectToCssStylesheet(styles, useHost, element) {
  return `${useHost ? ':host{' : ''}${Object.entries(styles)
    .map(([key, value]) => {
      if (Cell.isCell(/** @type any */ (value)) && element) {
        /** @param {any} innerValue */
        const callback = (innerValue) => {
          const stylePropertyKey = key.startsWith('--')
            ? key
            : toKebabCase(key);

          if (innerValue) {
            element.style.setProperty(stylePropertyKey, innerValue);
          } else {
            element.style.removeProperty(stylePropertyKey);
          }
        };

        if (!Reflect.has(element, '__attributeCells')) {
          Reflect.set(element, '__attributeCells', new Set());
        }
        Reflect.set(element, '__attributeCells', new Set());
        element.__attributeCells.add(callback);
        element.__attributeCells.add(value);

        value.listen(callback, { weak: true });
      }
      if (!value) return '';
      return `${
        key.startsWith('--') ? key : toKebabCase(key)
      }: ${value.valueOf()}`;
    })
    .join('; ')}${useHost ? '}' : ''}`;
}

/**
 * Converts a string to kebab-case.
 * @param {string} str - The input string to convert.
 * @returns {string} The input string converted to kebab-case.
 */
export function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * Generates an array of DOM nodes from a given input.
 * @param {JSX.Template | TemplateStringsArray} children - The input to generate DOM nodes from.
 * @returns {Node[]}
 */
export function generateChildNodes(children) {
  /** @type {Node[]} */
  const nodes = [];

  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    typeof children === 'boolean'
  ) {
    return [globalThis.window.document.createTextNode(String(children))];
  }

  if (children instanceof Promise) {
    const placeholder = globalThis.window.document.createComment('-------');
    children.then((template) => {
      placeholder.replaceWith(...generateChildNodes(template));
    });
    return [placeholder];
  }

  if (children instanceof globalThis.window.DocumentFragment) {
    return Array.from(children.childNodes);
  }

  if (children instanceof globalThis.window.Node) {
    return [children];
  }

  if (Array.isArray(children)) {
    return children.flatMap((child) => generateChildNodes(child));
  }

  return nodes;
}

/**
 * Checks if the given value is not an object.
 *
 * @param {any} value - The value to check.
 * @returns {boolean} `true` if the value is not an object, `false` otherwise.
 */
export function isNotObject(value) {
  return (
    !value.toString || !/function|object/.test(typeof value) || value === null
  );
}
