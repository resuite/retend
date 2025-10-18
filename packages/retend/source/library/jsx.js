/** @import * as VDom from '../v-dom/index.js' */
/** @import { CellSet } from './utils.js' */
/** @import { Scope } from './scope.js' */
/** @import { UpdatableFn } from '../plugin/hmr.js'; */

import { Cell, SourceCell } from '@adbl/cells';
import {
  getGlobalContext,
  isVNode,
  Modes,
  matchContext,
} from '../context/index.js';
import {
  ArgumentList,
  addCellListener,
  convertObjectToCssStylesheet,
  generateChildNodes,
  isDevMode,
  isSomewhatFalsy,
} from './utils.js';
import { ComponentInvalidator, setupHMRBoundaries } from '../plugin/hmr.js';
import { createScope, useScopeContext } from './scope.js';

const camelCasedAttributes = new Set([
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

const listenerModifiers = ['self', 'prevent', 'once', 'passive', 'stop'];

/**
 * @typedef {((this: Node, event: Event) => void) & {
 *  __getInnerFunction?: () => (WrapperFn | (() => void) | undefined)
 *  }} WrapperFn
 */

/** @type {Scope<UpdatableFn[]>} */
export const RetendComponentTree = createScope('__RetendComponentTree');

export function useComponentAncestry() {
  return useScopeContext(RetendComponentTree);
}

/**
 * Creates a new DOM element with the specified tag name, props, and children.
 *
 * @template {Record<PropertyKey, any> | ArgumentList<any[]>} Props
 * @param {any} tagname - The HTML tag name for the element.
 * @param {Props} props - An object containing the element's properties.
 * @returns {Node | VDom.VNode | (Node | VDom.VNode)[]} New DOM nodes.
 */
export function h(tagname, props) {
  if (tagname === undefined) return [];
  const { window } = getGlobalContext();

  if (Object.is(tagname, DocumentFragmentPlaceholder)) {
    const fragment = window.document.createDocumentFragment();
    const childList =
      typeof props === 'object' && !(props instanceof ArgumentList)
        ? props.children
          ? Array.isArray(props.children)
            ? props.children
            : [props.children]
          : []
        : [];
    for (const child of childList) {
      fragment.append(/** @type {*} */ (normalizeJsxChild(child)));
    }
    return fragment;
  }

  if (typeof tagname === 'function') {
    const completeProps =
      props instanceof ArgumentList
        ? props.data
        : typeof props === 'object'
        ? [{ ...props }]
        : [];

    if (isDevMode) {
      // In Dev mode and using HMR, components have a self-referential
      // Invalidator cell, which should automatically trigger a rerun of
      // the component.
      /** @type {Cell<Function>} */
      let invalidator = tagname[ComponentInvalidator];
      if (!tagname[ComponentInvalidator]) {
        invalidator = Cell.source(tagname);
        tagname[ComponentInvalidator] = invalidator;
      }
      const template = setupHMRBoundaries(invalidator, (c) => {
        /** @type {UpdatableFn[]} */
        let ancestry;
        try {
          ancestry = useComponentAncestry();
        } catch {
          ancestry = [];
        }
        return RetendComponentTree.Provider({
          // @ts-expect-error: if not, it recurses.
          h: false,
          value: [...ancestry, c],
          children: () => c(...completeProps, { createdByJsx: true }),
        });
      });
      return generateChildNodes(template);
    }

    const component = tagname(...completeProps, { createdByJsx: true });
    const nodes = generateChildNodes(component);
    // Tries to make the API more consistent and predictable.
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  if (props instanceof ArgumentList || typeof props !== 'object') {
    throw new Error('JSX props for native elements must be an object.');
  }

  const defaultNamespace = props?.xmlns ?? 'http://www.w3.org/1999/xhtml';

  let ns;
  if (tagname === 'svg') {
    ns = 'http://www.w3.org/2000/svg';
  } else if (tagname === 'math') {
    ns = 'http://www.w3.org/1998/Math/MathML';
  } else {
    ns = defaultNamespace;
  }

  const children = props.children;
  const element = /** @type {JsxElement} */ (
    window.document.createElementNS(ns, tagname)
  );
  element.__eventListenerList = new Map();
  element.__attributeCells = new Set();
  element.__createdByJsx = true;

  for (const [key, value] of Object.entries(props)) {
    setAttributeFromProps(element, key, value);
  }

  appendChild(element, tagname, children);

  return element;
}

/**
 * Appends a child node or an array of child nodes to a parent node.
 *
 * @param {Element | VDom.VElement | ShadowRoot | VDom.VShadowRoot} parentNode
 * The parent node to which the child will be appended.
 * @param {string} tagname
 * The tag name of the parent node.
 * @param {unknown} child
 * The child node, array of child nodes, or string to append.
 * @param {DocumentFragment | VDom.VDocumentFragment} [fragment]
 * The fragment to which the child will be appended.
 */
export function appendChild(parentNode, tagname, child, fragment) {
  const { window } = getGlobalContext();

  if (Array.isArray(child)) {
    // Using a fragment reduces the number of DOM operations.
    const fragment = window.document.createDocumentFragment();
    for (const childNode of child.flat(1)) {
      appendChild(parentNode, tagname, childNode, fragment);
    }
    parentNode.append(/** @type {*} */ (fragment));
    return;
  }

  if (!child) return;

  const childNode = normalizeJsxChild(child);

  if (
    childNode instanceof window.HTMLElement &&
    '__isShadowRootContainer' in childNode &&
    childNode.__isShadowRootContainer &&
    '__mode' in childNode
  ) {
    if (!(parentNode instanceof window.HTMLElement)) {
      console.error('ShadowRoot can only be children of HTML Elements.');
      return;
    }

    const mode = /** @type {ShadowRootMode} */ (childNode.__mode);
    const shadowRoot =
      parentNode.shadowRoot ?? parentNode.attachShadow({ mode });
    if (shadowRoot.mode !== mode) {
      console.error(
        'Shadowroot mode mismatch: Parent already has a shadowroot of a different type'
      );
      return;
    }
    appendChild(shadowRoot, tagname, [...childNode.childNodes]);
    return;
  }

  if (
    childNode instanceof window.HTMLElement &&
    (matchContext(window, Modes.VDom) ||
      window.customElements.get(childNode.tagName.toLowerCase()))
  ) {
    (fragment || parentNode).append(/** @type {*} */ (childNode));
    return;
  }

  // Client-side bailout for SVG and MathML elements.
  //
  // By default, elements are created using
  // Document.createElement(), which will only yield HTML-namespaced elements.
  //
  // This means that we end up with SVG and MathML specific elements
  // that look correct, but are not actually SVG or MathML elements.
  // To fix this, we need to serialize the badly formed elements
  // and recreate them using the namespace of the nearest svg or math parent.
  //
  // This will lead to a loss of interactivity, but idk, you win and you lose.
  if (
    matchContext(window, Modes.Interactive) &&
    (tagname === 'svg' || tagname === 'math') &&
    childNode instanceof window.HTMLElement
  ) {
    const elementNamespace = /** @type {string} */ (
      'namespaceURI' in parentNode
        ? parentNode.namespaceURI
        : 'http://www.w3.org/1999/xhtml'
    );
    const temp = window.document.createElementNS(elementNamespace, 'div');
    temp.innerHTML = /** @type {HTMLElement} */ (childNode).outerHTML;
    /** @type {ParentNode} */ (fragment || parentNode).append(...temp.children);
    return;
  }

  (fragment || parentNode).append(/** @type {*} */ (childNode));
}

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
 * @property {object} __finalProps
 * Props passed to the element.
 */

/**
 * @typedef {(Element | VDom.VElement) & HiddenElementProperties} JsxElement
 *
 */

/**
 * Sets an attribute on an element based on the provided props.
 *
 * @param {Element | VDom.VElement} el - The DOM element to set the attribute on.
 * @param {string} key - The name of the attribute to set.
 * @param {any} value - The value to set for the attribute. Can be a primitive value or an object with a `runAndListen` method.
 *
 * @description
 * If the value is an object with a `runAndListen` method, it sets up a reactive attribute.
 * Otherwise, it directly sets the attribute on the element.
 */
export function setAttributeFromProps(el, key, value) {
  const element = /** @type {JsxElement} */ (el);
  if (Cell.isCell(value)) {
    if (!element.__attributeCells) {
      element.__attributeCells = new Set();
    }
    if (key === 'ref') {
      element.__attributeCells.add(value);
      if (value instanceof SourceCell) {
        value.set(element);
        element.__ref = value;
      }
      return;
    }

    addCellListener(el, value, function (value) {
      setAttribute(this, key, value);
    });
  } else {
    setAttribute(el, key, value);
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
 * Normalizes a child jsx element for use in the DOM.
 * @param {JsxElement | Array<any> | string | number | boolean | object | undefined | null} child - The child element to normalize.
 * @returns {Node | VDom.VNode} The normalized child element.
 */
export function normalizeJsxChild(child) {
  const { window } = getGlobalContext();

  if (child instanceof window.Node) return child;

  if (Array.isArray(child)) {
    const fragment = window.document.createDocumentFragment();

    for (const element of child) {
      const childNodes = normalizeJsxChild(element);
      fragment.append(/** @type {*} */ (childNodes));
    }

    return fragment;
  }

  if (child === null || child === undefined) {
    return window.document.createTextNode('');
  }

  if (child instanceof Promise) {
    const placeholder = window.document.createComment('----');
    Reflect.set(placeholder, '__promise', child);
    child.then((value) => {
      placeholder.replaceWith(/** @type {*} */ (normalizeJsxChild(value)));
    });
    return placeholder;
  }

  // @ts-ignore: There is an error with the @adbl/cells library. Booleans should be allowed here.
  if (Cell.isCell(child)) {
    const textNode = window.document.createTextNode('');
    addCellListener(textNode, child, function (value) {
      this.textContent = String(value);
    });

    return textNode;
  }

  return window.document.createTextNode(child?.toString() ?? '');
}

/**
 * Normalizes a JSX class attribute value to a string.
 *
 * Handles various input types for class values, including strings, arrays, objects, and cells.
 *
 * @param {string | string[] | Cell<string | string[]> | Record<string, boolean > | undefined} val - The class value to normalize.
 * @param {JsxElement} element The target element with the class.
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

  if (Cell.isCell(val)) {
    let currentClassToken = normalizeClassValue(val.get(), element);
    addCellListener(
      element,
      val,
      function (newValue) {
        const classes =
          typeof newValue === 'string'
            ? newValue.split(' ')
            : newValue.map(String.prototype.split).flat();
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

  if (typeof val === 'object' && val !== null) {
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

export class DocumentFragmentPlaceholder {}

/**
 * Defines the `__jsx` and `__jsxFragment` global functions
 * for computing JSX components.
 */
export function defineJsxGlobals() {
  Reflect.set(globalThis, '__jsx', h);
  Reflect.set(globalThis, '__jsxFragment', DocumentFragmentPlaceholder);
}

export const jsx = h;
export const jsxFragment = DocumentFragmentPlaceholder;
export const Fragment = DocumentFragmentPlaceholder;
export default h;
