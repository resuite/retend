import { Cell } from '@adbl/cells';
import { getGlobalContext } from '../context/index.js';

/** @import * as VDom from '../v-dom/index.js' */
/** @import { JSX } from '../jsx-runtime/types.ts' */

/** @type {boolean | undefined} */ // @ts-ignore: check for dev mode on import type.
export const isDevMode = false;

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
   * @override
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
   * @override
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
   * @override
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
 * @typedef {((this: This, argument: T) => R) & {
 *    relatedCell?: Cell<T>,
 *    originalFunction?: ReactiveCellFunction<T, This>
 * }} ReactiveCellFunction
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
  // The original function has to be stored because (and I just found this out)
  // Calling .bind() on a function that is already bound leads to unintuitive
  // behavior. Functions that are already bound to VNodes cannot be rebound to
  // DOM elements.
  Reflect.set(boundCallback, 'originalFunction', callback);

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
 * @template {Node | VDom.VNode} [This=Node]
 * @param {This} element
 */
export function removeCellListeners(element) {
  const storage = /** @type {CellSet<This> | undefined} */ (
    Reflect.get(element, '__attributeCells')
  );
  if (!storage) return;

  for (const item of storage) {
    if (typeof item === 'function') {
      item.relatedCell?.ignore(item);
    }
  }

  storage.clear();
}

/**
 * @template {Node | VDom.VNode} [This=Node]
 * @param {This} sourceElement
 * @param {This} targetElement
 */
export function copyCellListeners(sourceElement, targetElement) {
  const sourceStorage =
    /** @type {CellSet<typeof sourceElement> | undefined} */ (
      Reflect.get(sourceElement, '__attributeCells')
    );

  if (!sourceStorage) return;

  for (const item of sourceStorage) {
    if (typeof item === 'function') {
      const boundCallback = item;
      const relatedCell = boundCallback.relatedCell;
      const originalFunction = boundCallback.originalFunction;

      if (relatedCell && originalFunction) {
        addCellListener(targetElement, relatedCell, originalFunction, false);
      }
    }
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
        addCellListener(
          element,
          value,
          function (newValue) {
            const styleKey = normalizeStyleKey(key);
            if (!isSomewhatFalsy(newValue)) {
              // optional because the style property does not exist in the vDOM.
              this.style?.setProperty(styleKey, newValue);
            } else {
              this.style?.removeProperty(styleKey);
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
 * Checks if a value is somewhat falsy.
 * @param {any} value
 * @returns {value is undefined | null | false}
 */
export function isSomewhatFalsy(value) {
  return value === undefined || value === null || value === false;
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

/**
 * Consolidates an array of nodes into a single Node or DocumentFragment.
 *
 * If the array contains only one node, that node is returned directly.
 * If the array contains multiple nodes, they are appended to a DocumentFragment,
 * which is then returned.
 *
 * @param {(Node | VDom.VNode)[]} nodes - The array of nodes to consolidate.
 */
export function consolidateNodes(nodes) {
  const { window } = getGlobalContext();
  if (nodes.length === 1) return nodes[0];
  else {
    const fragment = window.document.createDocumentFragment();
    fragment.append(.../** @type {*} */ (nodes));
    return fragment;
  }
}
