import { Cell } from '@adbl/cells';
import { getGlobalContext } from './context.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import * as VDom from '../v-dom/index.js' */

/** @type {boolean | undefined} */ // @ts-ignore: check for dev mode on import type.
export const isDevMode = import.meta.env?.DEV;

/**
 * @template T
 * A list of parameters that are passed to a component as props.
 * It is differentiated from an array of values or a single object.
 */
export class ArgumentList {
  /** @param {T} data */
  constructor(data) {
    this.data = data;
  }
}

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
 * @template T
 * @template {Node | VDom.VNode} [This=Node]
 * @template [R=void]
 * @typedef {((this: This, argument: T) => R) & { relatedCell?: Cell<T> }} ReactiveCellFunction
 */

/**
 * @template {Node | VDom.VNode} [This=Node]
 * @typedef {Set<Cell<*> | ReactiveCellFunction<*, This>>} CellSet
 */

/**
 * @template T
 * @template {Node | VDom.VNode} [This=Node]
 * @param {This} element
 * @param {Cell<T>} cell
 * @param {ReactiveCellFunction<T, This>} callback
 * @param {boolean} [runImmediately]
 */
export function addCellListener(
  element,
  cell,
  callback,
  runImmediately = true
) {
  /** @type {ReactiveCellFunction<T, This>} */
  const boundCallback = callback.bind(element);
  Reflect.set(boundCallback, 'relatedCell', cell);

  if (runImmediately) {
    cell.runAndListen(boundCallback, { weak: true });
  } else {
    cell.listen(boundCallback, { weak: true });
  }

  if (!('__attributeCells' in element)) {
    Reflect.set(element, '__attributeCells', new Set());
  }

  const storage = /** @type {CellSet<This>} */ (
    Reflect.get(element, '__attributeCells')
  );
  // Persist to prevent garbage collection.
  storage.add(boundCallback);
  storage.add(cell);
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
        addCellListener(
          element,
          value,
          function (newValue) {
            const styleKey = normalizeStyleKey(key);
            if (!isSomewhatFalsy(newValue)) {
              this.style.setProperty(styleKey, newValue);
            } else {
              this.style.removeProperty(styleKey);
            }
          },
          false
        );
      }
      if (isSomewhatFalsy(value)) return '';
      return `${normalizeStyleKey(key)}: ${value.valueOf()}`;
    })
    .join('; ')}${useHost ? '}' : ''}`;
}

/**
 * @param {string} key
 * @returns {string}
 */
function normalizeStyleKey(key) {
  return key.startsWith('--') ? key : toKebabCase(key);
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
 * @returns {(Node | VDom.VNode)[]}
 */
export function generateChildNodes(children) {
  const { window } = getGlobalContext();
  /** @type {Node[]} */
  const nodes = [];

  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    typeof children === 'boolean'
  ) {
    return [window.document.createTextNode(String(children))];
  }

  if (children instanceof Promise) {
    const placeholder = window.document.createComment('-------');
    Reflect.set(placeholder, '__promise', children);
    children.then((template) => {
      if (placeholder.parentNode) {
        placeholder.replaceWith(
          .../** @type {*} */ (generateChildNodes(template))
        );
      }
    });
    return [placeholder];
  }

  if (children instanceof window.DocumentFragment) {
    return Array.from(/** @type {*} */ (children).childNodes);
  }

  if (children instanceof window.Node) {
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

/**
 * @template T
 * Checks if a value is somewhat falsy.
 * @param {T} value
 * @returns {value is undefined | null | false}
 */
export function isSomewhatFalsy(value) {
  return value === undefined || value === null || value === false;
}

/**
 * Gets the most current instance of the given function.
 *
 * @param {Function & import('../render/index.js').UpdatableFn} fn
 * @returns {(...args: any[]) => any}
 */
export function getMostCurrentFunction(fn) {
  let currentFn = fn;
  while (currentFn.__nextInstance) {
    currentFn = currentFn.__nextInstance;
  }
  // @ts-ignore
  return currentFn;
}

/** @typedef {(VDom.VComment | Comment) & { __commentRangeSymbol?: symbol }} ConnectedComment */

/**
 * Creates a pair of connected comment nodes that can be used to represent a range.
 * @returns {[ConnectedComment, ConnectedComment]} A pair of connected comment nodes with a shared symbol.
 */
export function createCommentPair() {
  const { window } = getGlobalContext();
  const symbol = Symbol();
  const rangeStart = window.document.createComment('----');
  const rangeEnd = window.document.createComment('----');
  Reflect.set(rangeStart, '__commentRangeSymbol', symbol);
  Reflect.set(rangeEnd, '__commentRangeSymbol', symbol);

  return [rangeStart, rangeEnd];
}
