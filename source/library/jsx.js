import { Cell, SourceCell } from '@adbl/cells';
import {
  convertObjectToCssStylesheet,
  generateChildNodes,
  getMostCurrentFunction,
  isSomewhatFalsy,
} from './utils.js';
import { linkNodesToComponent } from '../render/index.js';
import { getGlobalContext, matchContext, Modes } from './context.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import * as VDom from '../v-dom/index.js' */

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

/**
 * Creates a new DOM element with the specified tag name, props, and children.
 *
 * @template {Record<PropertyKey, any>} Props
 * @param {any} tagname - The HTML tag name for the element.
 * @param {Props} props - An object containing the element's properties.
 * @returns {Node | VDom.VNode | (Node | VDom.VNode)[]} New DOM nodes.
 */
export function h(tagname, props) {
  const { window } = getGlobalContext();
  const children = props.children;

  if (Object.is(tagname, DocumentFragmentPlaceholder)) {
    const fragment = window.document.createDocumentFragment();
    const childList = children
      ? Array.isArray(children)
        ? children
        : [children]
      : [];
    for (const child of childList) {
      fragment.appendChild(
        /** @type {*} */ (normalizeJsxChild(child, fragment))
      );
    }
    return fragment;
  }

  if (typeof tagname === 'function') {
    const completeProps = { ...props };
    // In Dev mode and using HMR, the function may have been overwritten.
    // In this case we need the latest version of the function.
    const current = getMostCurrentFunction(tagname);
    const component = current(completeProps, {
      createdByJsx: true,
    });
    const nodes = generateChildNodes(component);
    linkNodesToComponent(nodes, current, completeProps);
    return nodes;
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
 * @param {Element | VDom.VElement | ShadowRoot | VDom.VShadowRoot} parentNode - The parent node to which the child will be appended.
 * @param {string} tagname - The tag name of the parent node.
 * @param {unknown} child - The child node, array of child nodes, or string to append.
 */
export function appendChild(parentNode, tagname, child) {
  const { window } = getGlobalContext();

  if (Array.isArray(child)) {
    for (const childNode of child) {
      appendChild(parentNode, tagname, childNode);
    }
    return;
  }

  if (!child) return;

  const childNode = normalizeJsxChild(child, parentNode);

  if (
    childNode instanceof window.HTMLElement &&
    '__isShadowRootContainer' in childNode &&
    childNode.__isShadowRootContainer
  ) {
    if (!(parentNode instanceof window.HTMLElement)) {
      console.error('ShadowRoot can only be children of HTML Elements.');
      return;
    }
    // @ts-expect-error
    const mode = childNode.__mode;
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
    parentNode.appendChild(/** @type {*} */ (childNode));
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
    /** @type {ParentNode} */ (parentNode).append(...temp.children);
    return;
  }

  parentNode.appendChild(/** @type {*} */ (childNode));
}

/**
 * @typedef HiddenElementProperties
 * @property {Map<string, (event: Event) => void>} __eventListenerList
 * List of event listeners set as attributes on the element.
 * @property {Map<string, WrapperFn>} __modifiedListenerList
 * @property {Set<object | ((value: any) => void)>} __attributeCells
 * List of cell callbacks set as attributes on the element.
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
        value.value = element;
        element.__ref = value;
      }
      return;
    }

    /** @param {any} value */
    const callback = (value) => {
      setAttribute(element, key, value);
    };
    value.runAndListen(callback, { weak: true });
    element.__attributeCells.add(callback);
    element.__attributeCells.add(value);
  } else {
    setAttribute(element, key, value);
  }
}

/**
 * Sets an attribute on an element.
 * @param {JsxElement} element - The element to set the attribute on.
 * @param {string} key - The name of the attribute.
 * @param {any} value - The value of the attribute.
 */
export function setAttribute(element, key, value) {
  const createdByJsx = true;

  // store element event listeners.
  if (
    key.startsWith('on') &&
    key.length > 2 &&
    (!createdByJsx || (createdByJsx && typeof value !== 'string'))
  ) {
    setEventListener(element, key, value);
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
    element.innerHTML = value.html;
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

  const attributeName = key.replace(/([A-Z])/g, (match) => {
    return `-${match.toLowerCase()}`;
  });

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
 * @param {JsxElement} element - The element to set the attribute on.
 * @param {string} key - The name of the attribute.
 * @param {any} value - The value of the attribute.
 */
export function setEventListener(element, key, value) {
  const createdByJsx = true;

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
      setTimeout(() => {
        element.addEventListener(eventName, value);
        element.__eventListenerList.set(eventName, value);
      }, 0);
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

      setTimeout(() => {
        element.addEventListener(eventName, wrapper, options);
        element.__modifiedListenerList.set(rawEventName, wrapper);
      }, 0);
    }
  }
}

/**
 * Normalizes a child jsx element for use in the DOM.
 * @param {JsxElement | Array<any> | string | number | boolean | object | undefined | null} child - The child element to normalize.
 * @param {ParentNode | VDom.VNode} [_parent] - The parent node of the child.
 * @returns {Node | VDom.VNode} The normalized child element.
 */
export function normalizeJsxChild(child, _parent) {
  const { window } = getGlobalContext();

  if (child instanceof window.Node) return child;

  if (Array.isArray(child)) {
    const fragment = window.document.createDocumentFragment();

    for (const element of child) {
      const childNodes = normalizeJsxChild(element, fragment);
      fragment.appendChild(/** @type {*} */ (childNodes));
    }

    return fragment;
  }

  if (child === null || child === undefined) {
    return window.document.createTextNode('');
  }

  // @ts-ignore: There is an error with the @adbl/cells library. Booleans should be allowed here.
  if (Cell.isCell(child)) {
    const textNode = window.document.createTextNode('');
    /** @param {any} value */
    const callback = (value) => {
      textNode.textContent = value;
    };
    child.runAndListen(callback, { weak: true });

    // Persists the references to the value and the callback so they don't get garbage collected.
    if (!Reflect.has(textNode, '__attributeCells')) {
      Reflect.set(textNode, '__attributeCells', new Set());
    }
    const cells = Reflect.get(textNode, '__attributeCells');

    if (cells) {
      cells.add(callback);
      cells.add(child);
    }
    return textNode;
  }

  return window.document.createTextNode(child?.toString() ?? '');
}

/**
 * Normalizes a JSX class attribute value to a string.
 *
 * Handles various input types for class values, including strings, arrays, objects, and cells.
 *
 * @param {string | string[] | Record<string, boolean > | Cell<string> | undefined} val - The class value to normalize.
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
    let currentClassToken = val.value;
    /** @type {(newValue: string) => void} */
    const callback = (newValue) => {
      try {
        element.classList.remove(...currentClassToken.split(' '));
      } catch {}
      try {
        element.classList.add(...newValue.split(' '));
      } catch {}
      currentClassToken = newValue;
    };

    val.listen(callback, { weak: true });
    if (!element.__attributeCells) {
      element.__attributeCells = new Set();
    }
    element.__attributeCells.add(val);
    element.__attributeCells.add(callback);
    return currentClassToken;
  }

  if (typeof val === 'object' && val !== null) {
    let result = '';
    for (const [key, value] of Object.entries(val)) {
      if (Cell.isCell(value)) {
        /** @type {(newValue: boolean) => void} */
        const callback = (newValue) => {
          if (newValue) {
            try {
              element.classList.add(...key.split(' '));
            } catch {}
          } else {
            try {
              element.classList.remove(...key.split(' '));
            } catch {}
          }
        };

        value.listen(callback, { weak: true });
        if (!element.__attributeCells) {
          element.__attributeCells = new Set();
        }
        element.__attributeCells.add(value);
        element.__attributeCells.add(callback);
        if (value.value) {
          result += ` ${key}`;
        }
        continue;
      }

      if (!value) {
        result += ` ${key}`;
      }
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
