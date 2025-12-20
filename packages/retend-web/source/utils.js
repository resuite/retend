/** @import * as VDom from 'retend/v-dom' */
/** @import { JsxElement } from './dom-renderer.js'; */
import { getActiveRenderer, Cell } from 'retend';
import { DOMRenderer } from './dom-renderer.js';
import { getGlobalContext, isVNode } from 'retend/context';

/** @typedef {(VDom.VComment | Comment) & { __commentRangeSymbol?: symbol }} ConnectedComment */

/**
 * @typedef {((this: Node, event: Event) => void) & {
 *  __getInnerFunction?: () => (WrapperFn | (() => void) | undefined)
 *  }} WrapperFn
 */

/**
 * @typedef HiddenElementProperties
 * @property {Map<string, (event: Event) => void>} __eventListenerList
 * List of event listeners set as attributes on the element.
 * @property {Map<string, WrapperFn>} __modifiedListenerList
 * @property {CellSet} __attributeCells
 * List of cell callbacks sets on the element.
 * @property {boolean} __createdByJsx
 * Whether or not the element was created using JSX syntax.
 * @property {string | boolean | number | undefined} __key
 * Unique key for the element.
 * @property {Cell<unknown> | undefined} __ref
 * Cellular reference pointing to the element.
 */

/**
 * Creates a pair of connected comment nodes that can be used to represent a range.
 * @returns {[ConnectedComment, ConnectedComment]} A pair of connected comment nodes with a shared symbol.
 */
export function createCommentPair() {
  /** @type {DOMRenderer} */ //@ts-expect-error: guaranteed to be in DOM environment.
  const renderer = getActiveRenderer();
  const symbol = Symbol();
  const rangeStart = renderer.host.document.createComment('----');
  const rangeEnd = renderer.host.document.createComment('----');
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
  /** @type {DOMRenderer} */ //@ts-expect-error: guaranteed to be in DOM environment.
  const renderer = getActiveRenderer();
  if (nodes.length === 1) return nodes[0];

  const fragment = renderer.host.document.createDocumentFragment();
  fragment.append(.../** @type {*} */ (nodes));
  return fragment;
}

/**
 * @param {string} id
 * @param {string} contents
 * @param {Window | VDom.VWindow} window
 */
export function writeStaticStyle(id, contents, window) {
  const { globalData } = getGlobalContext();
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
 * @template [This=Node]
 * @typedef {Set<Cell<*> | ReactiveCellFunction<*, This>>} CellSet
 */

/**
 * @template [This=Node]
 * @param {This} node
 */
export function removeCellListeners(node) {
  if (node && typeof node === 'object') {
    const storage = /** @type {CellSet<This> | undefined} */ (
      Reflect.get(node, '__attributeCells')
    );
    if (!storage) return;

    for (const item of storage) {
      if (typeof item === 'function') {
        item.relatedCell?.ignore(item);
      }
    }

    storage.clear();
  }
}

/**
 * @template [This=Node]
 * @param {This} source
 * @param {This} target
 */
export function copyCellListeners(source, target) {
  if (source && typeof source === 'object') {
    const sourceStorage = /** @type {CellSet<typeof source> | undefined} */ (
      Reflect.get(source, '__attributeCells')
    );

    if (!sourceStorage) return;

    for (const item of sourceStorage) {
      if (typeof item === 'function') {
        const boundCallback = item;
        const relatedCell = boundCallback.relatedCell;
        const originalFunction = boundCallback.originalFunction;

        if (
          relatedCell &&
          originalFunction &&
          target &&
          typeof target === 'object'
        ) {
          addCellListener(target, relatedCell, originalFunction, false);
        }
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

export const listenerModifiers = ['self', 'prevent', 'once', 'passive', 'stop'];

/**
 * Normalizes a JSX class attribute value to a string.
 *
 * Handles various input types for class values, including strings, arrays, objects, and cells.
 *
 * @param {string | string[] | Cell<string | string[]> | Record<string, boolean > | undefined} val - The class value to normalize.
 * @param {JsxElement} [element] The target element with the class.
 * @returns {string} The normalized class value as a string.
 */
export function normalizeClassValue(val, element) {
  if (typeof val === 'string') {
    return val;
  }

  if (Array.isArray(val)) {
    let result = '';
    for (const [index, value] of val.entries()) {
      const normalized = normalizeClassValue(value, element);
      if (normalized) {
        result += normalized;
      }
      if (index !== val.length - 1) {
        result += ' ';
      }
    }
    return result;
  }

  if (Cell.isCell(val) && element) {
    let currentClassToken = normalizeClassValue(val.get(), element);
    addCellListener(
      element,
      val,
      function (newValue) {
        const classes =
          typeof newValue === 'string'
            ? newValue.split(' ')
            : newValue.flatMap(String.prototype.split);
        try {
          this.classList.remove(...currentClassToken.split(' '));
          this.classList.add(...classes);
        } catch {
          //
        }
        currentClassToken = classes.join(' ');
      },
      false
    );
    return currentClassToken;
  }

  if (typeof val === 'object' && val !== null && element) {
    let result = '';
    for (const [key, value] of Object.entries(val)) {
      if (!Cell.isCell(value)) {
        if (value) result += ` ${key}`;
        continue;
      }

      addCellListener(
        element,
        value,
        function (newValue) {
          try {
            if (newValue) {
              this.classList.add(...key.split(' '));
            } else {
              this.classList.remove(...key.split(' '));
            }
          } catch {
            //
          }
        },
        false
      );
      if (value.get()) result += ` ${key}`;
    }
    return result;
  }

  return '';
}

/**
 * Sets an event Listener on an element.
 * @param {Element | VDom.VElement} el - The element to set the attribute on.
 * @param {string} key - The name of the attribute.
 * @param {any} value - The value of the attribute.
 */
export function setEventListener(el, key, value) {
  const createdByJsx = true;
  const element = /** @type {JsxElement} */ (el);

  if (isVNode(element)) {
    // Event listeners are not useful in the VDom,
    // but they need to be stored so they can be propagated to the
    // static DOM representation in the browser.
    element.setHiddenAttribute(key, value);
    return;
  }

  if (createdByJsx && key[2].toLowerCase() === key[2]) {
    return;
  }
  const rawEventName = /** @type {keyof ElementEventMap} */ (
    key.slice(2).toLowerCase()
  );
  const [eventName, ...modifiers] = rawEventName.split('--');
  for (const modifier of modifiers) {
    if (!listenerModifiers.includes(modifier)) {
      console.warn(`Unknown event listener modifier: ${modifier}`);
    }
  }

  if (!element.__eventListenerList) {
    element.__eventListenerList = new Map();
  }
  if (!element.__modifiedListenerList) {
    element.__modifiedListenerList = new Map();
  }

  // remove stale listeners
  if (!modifiers.length) {
    element.removeEventListener(eventName, value);
    const oldValue = element.__eventListenerList.get(eventName);
    if (oldValue !== undefined && oldValue !== value) {
      element.removeEventListener(eventName, oldValue);
      element.__eventListenerList.delete(eventName);
    }

    if (typeof value === 'function') {
      element.addEventListener(eventName, value);
      element.__eventListenerList.set(eventName, value);
      return;
    }
  } else {
    const oldValue = element.__modifiedListenerList.get(rawEventName);
    const oldUserFunction = oldValue?.__getInnerFunction?.();
    if (
      oldValue !== undefined &&
      oldUserFunction &&
      oldUserFunction !== value
    ) {
      element.removeEventListener(eventName, oldUserFunction);
      element.__modifiedListenerList.delete(rawEventName);
    }

    if (typeof value === 'function') {
      /** @type {WrapperFn | undefined} */
      let wrapper = function (event) {
        return value.bind(this)(event);
      };
      wrapper.__getInnerFunction = function () {
        this; // only here to silence biome.
        return value;
      };

      /** @type {Record<string, unknown>} */
      const options = {};
      for (const modifier of modifiers) {
        const oldWrapper = wrapper;
        if (modifier === 'self') {
          wrapper = function (event) {
            if (event.target !== event.currentTarget) return;
            oldWrapper.bind(this)(event);
          };
        } else if (modifier === 'prevent') {
          wrapper = function (event) {
            event.preventDefault();
            oldWrapper.bind(this)(event);
          };
        } else if (modifier === 'once') {
          options.once = true;
          wrapper = function (event) {
            oldWrapper.bind(this)(event);
            const element = /** @type {JsxElement} */ (event.currentTarget);
            element?.__modifiedListenerList.delete(rawEventName);
          };
        } else if (modifier === 'stop') {
          wrapper = function (event) {
            event.stopPropagation();
            oldWrapper.bind(this)(event);
            const element = /** @type {JsxElement} */ (event.currentTarget);
            element.__modifiedListenerList.delete(rawEventName);
          };
        } else if (modifier === 'passive') {
          options.passive = true;
        }

        wrapper.__getInnerFunction = function () {
          this; // only here to silence biome.
          return oldWrapper?.__getInnerFunction?.();
        };
      }

      element.addEventListener(eventName, wrapper, options);
      element.__modifiedListenerList.set(rawEventName, wrapper);
    }
  }
}

/**
 * Sets an attribute on an element.
 * @param {Element | VDom.VElement} el - The element to set the attribute on.
 * @param {string} key - The name of the attribute.
 * @param {any} value - The value of the attribute.
 */
export function setAttribute(el, key, value) {
  const createdByJsx = true;
  const element = /** @type {JsxElement} */ (el);

  // store element event listeners.
  if (
    key.startsWith('on') &&
    key.length > 2 &&
    (!createdByJsx || (createdByJsx && typeof value !== 'string'))
  ) {
    setEventListener(el, key, value);
    return;
  }

  if (key === 'children') {
    return;
  }

  if (key.startsWith('aria')) {
    const ariaKey = `aria-${key.slice(4).toLowerCase()}`;

    if (isSomewhatFalsy(value)) {
      element.removeAttribute(ariaKey);
    } else {
      element.setAttribute(ariaKey, value);
    }
    return;
  }

  if (
    key.startsWith('form') ||
    key.startsWith('popover') ||
    key.startsWith('auto') ||
    key === 'tabIndex'
  ) {
    const attrKey = key.toLowerCase();

    if (isSomewhatFalsy(value)) {
      element.removeAttribute(attrKey);
    } else {
      element.setAttribute(attrKey, value);
    }

    return;
  }

  if (
    key === 'dangerouslySetInnerHTML' &&
    typeof value === 'object' &&
    value !== null &&
    '__html' in value &&
    typeof value.__html === 'string'
  ) {
    element.innerHTML = value.__html;
    return;
  }

  if (key === 'style' && typeof value === 'object' && value !== null) {
    element.setAttribute(
      'style',
      convertObjectToCssStylesheet(value, false, element)
    );
    return;
  }

  if (key === 'key') {
    element.__key = value;
    return;
  }

  if (camelCasedAttributes.has(key)) {
    if (isSomewhatFalsy(value)) {
      element.removeAttribute(key);
    } else {
      element.setAttribute(key, value);
    }
    return;
  }

  const attributeName = key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

  if (attributeName === 'class-name' || attributeName === 'class') {
    const normalizedClass = normalizeClassValue(value, element);
    if (normalizedClass) {
      element.setAttribute('class', normalizedClass);
    } else {
      element.removeAttribute('class');
    }
    return;
  }

  if (isSomewhatFalsy(value)) {
    element.removeAttribute(key);
  } else {
    element.setAttribute(attributeName, value);
  }
}
