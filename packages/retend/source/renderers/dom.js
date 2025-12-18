/** @import { InteractiveRenderer } from "./types.js"; */
/** @import { NodeLike, FragmentLike } from "../context/index.js"; */
/** @import { CellSet } from '../library/utils.js' */
/** @import * as VDom from '../v-dom/index.js' */
/** @import { jsxDevFileData, UpdatableFn } from '../plugin/hmr.js'; */

import { Cell, SourceCell } from '@adbl/cells';
import {
  getGlobalContext,
  isVNode,
  matchContext,
  Modes,
} from '../context/index.js';
import {
  addCellListener,
  camelCasedAttributes,
  convertObjectToCssStylesheet,
  isSomewhatFalsy,
  listenerModifiers,
} from '../library/utils.js';
import {
  appendChild,
  generateChildNodes,
  normalizeJsxChild,
} from './_shared.js';
import { withHMRBoundaries } from '../plugin/hmr.js';

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
 * @typedef {(Element | VDom.VElement) & HiddenElementProperties} JsxElement
 *
 */

/**
 * @implements {InteractiveRenderer<NodeLike, NodeLike, FragmentLike>}
 */
export class DomRenderer {
  isInteractive = /** @type {const} */ (true);

  /**
   * @param {NodeLike} node
   * @param {string} key
   * @param {any} value
   */
  setProperty(node, key, value) {
    const element = /** @type {JsxElement} */ (node);
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
        return node;
      }
      const setAttribute = this.#setAttribute;
      addCellListener(element, value, function (value) {
        setAttribute(this, key, value);
      });
    } else {
      this.#setAttribute(element, key, value);
    }
    return node;
  }

  /**
   * @param {UpdatableFn} tagname
   * @param {any} props
   * @param {jsxDevFileData} [fileData]
   */
  handleComponent(tagname, props, fileData) {
    // @ts-expect-error: Vite types are not ingrained
    if (import.meta.env?.DEV) {
      return withHMRBoundaries(tagname, props, fileData);
    }
    const component = tagname(...props);
    /** @type {NodeLike[]} */
    const nodes = generateChildNodes(component, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  /**
   * @param {NodeLike} parentNode
   * @param {NodeLike | NodeLike[]} childNode
   */
  append(parentNode, childNode) {
    const { window } = getGlobalContext();
    if (
      childNode instanceof window.DocumentFragment &&
      '__isShadowRootContainer' in childNode &&
      childNode.__isShadowRootContainer &&
      '__mode' in childNode
    ) {
      if (!(parentNode instanceof window.HTMLElement)) {
        console.error('ShadowRoot can only be children of HTML Elements.');
        return parentNode;
      }

      const mode = /** @type {ShadowRootMode} */ (childNode.__mode);
      const shadowRoot =
        parentNode.shadowRoot ?? parentNode.attachShadow({ mode });
      if (shadowRoot.mode !== mode) {
        console.error(
          'Shadowroot mode mismatch: Parent already has a shadowroot of a different type'
        );
        return parentNode;
      }
      appendChild(shadowRoot, [...childNode.childNodes], this);
      return parentNode;
    }
    const tagname = Reflect.get(parentNode, 'tagName');

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
      return parentNode;
    }
    if (Array.isArray(childNode)) {
      const children = /** @type {*} */ (childNode.filter(Boolean));
      /** @type {ParentNode} */ (parentNode).append(...children);
    } else {
      /** @type {ParentNode} */ (parentNode).append(
        /** @type {*} */ (childNode)
      );
    }

    return parentNode;
  }

  /**
   * @param {Promise<any>} child
   */
  handlePromise(child) {
    const { window } = getGlobalContext();
    const placeholder = window.document.createComment('----');
    Reflect.set(placeholder, '__promise', child);
    child.then((value) => {
      placeholder.replaceWith(
        /** @type {*} */ (normalizeJsxChild(value, this))
      );
    });
    return placeholder;
  }

  /**
   * @param {string} text
   * @param {NodeLike} node
   */
  setText(text, node) {
    // @ts-ignore
    node.textContent = text;
    return node;
  }

  /**
   * @param {NodeLike} node
   */
  finalize(node) {
    return node;
  }

  /**
   * @param {NodeLike | NodeLike[]} [input]
   */
  createNodeGroup(input) {
    const { window } = getGlobalContext();
    const fragment = window.document.createDocumentFragment();
    if (input) {
      const children = Array.isArray(input) ? input : [input];
      for (const child of children) {
        appendChild(fragment, child, this);
      }
    }
    return fragment;
  }

  /**
   * @param {any} group
   * @returns {NodeLike[]}
   */
  unwrapNodeGroup(group) {
    return Array.from(group.childNodes);
  }

  /**
   * @param {string} tagname
   * @param {string} [namespace]
   */
  createElement(tagname, namespace) {
    const { window } = getGlobalContext();
    const defaultNamespace = namespace ?? 'http://www.w3.org/1999/xhtml';

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
    return element;
  }

  /**
   * @param {string} text
   */
  createText(text) {
    const { window } = getGlobalContext();
    return window.document.createTextNode(text);
  }

  /**
   * @param {NodeLike} node
   * @returns {node is FragmentLike}
   */
  isGroup(node) {
    const { window } = getGlobalContext();
    return (
      node instanceof window.DocumentFragment &&
      !('__isShadowRootContainer' in node)
    );
  }

  /**
   * @param {any} child
   * @returns {child is NodeLike}
   */
  isNode(child) {
    const { window } = getGlobalContext();
    return child instanceof window.Node;
  }

  /**
   * Sets an attribute on an element.
   * @param {Element | VDom.VElement} el - The element to set the attribute on.
   * @param {string} key - The name of the attribute.
   * @param {any} value - The value of the attribute.
   */
  #setAttribute(el, key, value) {
    const createdByJsx = true;
    const element = /** @type {JsxElement} */ (el);

    // store element event listeners.
    if (
      key.startsWith('on') &&
      key.length > 2 &&
      (!createdByJsx || (createdByJsx && typeof value !== 'string'))
    ) {
      this.#setEventListener(el, key, value);
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
  #setEventListener(el, key, value) {
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
}

/**
 * Normalizes a JSX class attribute value to a string.
 *
 * Handles various input types for class values, including strings, arrays, objects, and cells.
 *
 * @param {string | string[] | Cell<string | string[]> | Record<string, boolean > | undefined} val - The class value to normalize.
 * @param {JsxElement} [element] The target element with the class.
 * @returns {string} The normalized class value as a string.
 */
function normalizeClassValue(val, element) {
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
