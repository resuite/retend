import { Cell } from '@adbl/cells';
import { getGlobalContext } from '../context/index.js';

/** @import * as VDom from '../v-dom/index.js' */

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
 * @template T
 * @template [This=Node]
 * @template [R=void]
 * @typedef {((this: This, argument: T) => R) & {
 *    relatedCell?: Cell<T>,
 *    originalFunction?: ReactiveCellFunction<T, This>
 * }} ReactiveCellFunction
 */

/**
 * @template [This=Node]
 * @typedef {Set<Cell<*> | ReactiveCellFunction<*, This>>} CellSet
 */

/**
 * @template T
 * @template This
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

  if (element && typeof element === 'object') {
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
 *
 * @param {Node | VDom.VNode} start
 * @param {Node | VDom.VNode} end
 */
export function isMatchingCommentPair(start, end) {
  return (
    Reflect.get(start, '__commentRangeSymbol') ===
    Reflect.get(end, '__commentRangeSymbol')
  );
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

  const fragment = window.document.createDocumentFragment();
  fragment.append(.../** @type {*} */ (nodes));
  return fragment;
}

/**
 * @param {string} id
 * @param {string} contents
 */
export function writeStaticStyle(id, contents) {
  const { window, globalData } = getGlobalContext();
  const { head } = window.document;
  const formatted = `retend:static-style-ids:${id}`;
  const writtenId = globalData.get(formatted);
  if (writtenId) return;

  const newStyle = window.document.createElement('style');
  newStyle.setAttribute('id', id);
  newStyle.innerHTML = contents;
  head.append(/** @type {*} */ (newStyle));
  globalData.set(formatted, id);
}

export const camelCasedAttributes = new Set([
  // SVG attributes
  'attributeName',
  'attributeType',
  'baseFrequency',
  'baseProfile',
  'calcMode',
  'clipPathUnits',
  'diffuseConstant',
  'edgeMode',
  'filterUnits',
  'glyphRef',
  'gradientTransform',
  'gradientUnits',
  'kernelMatrix',
  'kernelUnitLength',
  'keyPoints',
  'keySplines',
  'keyTimes',
  'lengthAdjust',
  'limitingConeAngle',
  'markerHeight',
  'markerUnits',
  'markerWidth',
  'maskContentUnits',
  'maskUnits',
  'numOctaves',
  'pathLength',
  'patternContentUnits',
  'patternTransform',
  'patternUnits',
  'pointsAtX',
  'pointsAtY',
  'pointsAtZ',
  'preserveAlpha',
  'preserveAspectRatio',
  'primitiveUnits',
  'refX',
  'refY',
  'repeatCount',
  'repeatDur',
  'requiredExtensions',
  'requiredFeatures',
  'specularConstant',
  'specularExponent',
  'spreadMethod',
  'startOffset',
  'stdDeviation',
  'stitchTiles',
  'surfaceScale',
  'systemLanguage',
  'tableValues',
  'targetX',
  'targetY',
  'textLength',
  'viewBox',
  'viewTarget',
  'xChannelSelector',
  'yChannelSelector',
  'zoomAndPan',

  // MathML attributes
  'columnAlign',
  'columnLines',
  'columnSpacing',
  'displayStyle',
  'equalColumns',
  'equalRows',
  'frameSpacing',
  'labelSpacing',
  'longdivStyle',
  'maxSize',
  'minSize',
  'movablelimits',
  'rowAlign',
  'rowLines',
  'rowSpacing',
  'scriptLevel',
  'scriptMinSize',
  'scriptSizemultiplier',
  'stackAlign',
  'useHeight',

  // HTML attributes (there are no natively camel cased HTML attributes,
  // but including this comment for completeness)
]);

/**
 * Escapes HTML special characters to prevent XSS and maintain correct rendering
 * @param {*} str
 * @returns {string}
 */
export function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const listenerModifiers = ['self', 'prevent', 'once', 'passive', 'stop'];
