import { Cell, SourceCell } from '@adbl/cells';
import { convertObjectToCssStylesheet, generateChildNodes } from './utils.js';
import { linkNodesToComponent } from '../render/index.js';

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

/**
 * Creates a new DOM element with the specified tag name, props, and children.
 *
 * @template {Record<PropertyKey, any>} Props
 * @param {any} tagname - The HTML tag name for the element.
 * @param {Props} props - An object containing the element's properties.
 * @returns {Node | Node[]} New DOM nodes.
 */
export function h(tagname, props) {
  const children = props.children;
  if (Object.is(tagname, DocumentFragmentPlaceholder)) {
    const fragment = globalThis.window.document.createDocumentFragment();
    for (const child of children ?? []) {
      fragment.appendChild(normalizeJsxChild(child, fragment));
    }
    return fragment;
  }

  if (typeof tagname === 'function') {
    const completeProps = { ...props };
    const component = tagname(completeProps, { createdByJsx: true });
    const nodes = generateChildNodes(component);
    linkNodesToComponent(nodes, tagname, completeProps);
    return nodes;
  }

  const defaultNamespace = props?.xmlns ?? 'http://www.w3.org/1999/xhtml';

  let namespace;
  if (tagname === 'svg') {
    namespace = 'http://www.w3.org/2000/svg';
  } else if (tagname === 'math') {
    namespace = 'http://www.w3.org/1998/Math/MathML';
  } else {
    namespace = defaultNamespace;
  }
  /** @type {JsxElement} */ //@ts-ignore: coercion.
  const element = globalThis.window.document.createElementNS(
    namespace,
    tagname
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
 *  @param {JsxElement} element
 * @param {string} tagname
 *  @param {any} child
 */
export function appendChild(element, tagname, child) {
  if (Array.isArray(child)) {
    for (const childNode of child) {
      appendChild(element, tagname, childNode);
    }
    return;
  }

  if (!child) return;

  const childNode = normalizeJsxChild(child, element);
  if (
    childNode instanceof globalThis.window.HTMLElement &&
    globalThis.window.customElements.get(childNode.tagName.toLowerCase())
  ) {
    element.appendChild(childNode);
    return;
  }

  if (
    (tagname === 'svg' || tagname === 'math') &&
    childNode instanceof globalThis.window.HTMLElement
  ) {
    const temp = globalThis.window.document.createElementNS(
      element.namespaceURI ?? '',
      'div'
    );
    temp.innerHTML = childNode.outerHTML;
    element.append(...Array.from(temp.children));
    return;
  }

  element.appendChild(childNode);
}

/**
 * @typedef HiddenElementProperties
 * @property {Map<string, (() => void)[]>} __eventListenerList
 * List of event listeners set as attributes on the element.
 * @property {Set<object | ((value: any) => void)>} __attributeCells
 * List of cell callbacks set as attributes on the element.
 * @property {boolean} __createdByJsx
 * Whether or not the element was created using JSX syntax.
 * @property {string | boolean | number | undefined} __key
 * Unique key for the element.
 * @property {object} __finalProps
 * Props passed to the element.
 */

/**
 * @typedef {Element & HiddenElementProperties} JsxElement
 *
 */

/**
 * Sets an attribute on an element based on the provided props.
 *
 * @param {JsxElement} element - The DOM element to set the attribute on.
 * @param {string} key - The name of the attribute to set.
 * @param {any} value - The value to set for the attribute. Can be a primitive value or an object with a `runAndListen` method.
 *
 * @description
 * If the value is an object with a `runAndListen` method, it sets up a reactive attribute.
 * Otherwise, it directly sets the attribute on the element.
 */
export function setAttributeFromProps(element, key, value) {
  if (Cell.isCell(value)) {
    if (!element.__attributeCells) {
      element.__attributeCells = new Set();
    }
    if (key === 'ref') {
      element.__attributeCells.add(value);
      if (value instanceof SourceCell) {
        value.value = element;
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
    if (createdByJsx && key[2].toLowerCase() === key[2]) {
      return;
    }
    const eventName = /** @type {keyof ElementEventMap} */ (
      key.slice(2).toLowerCase()
    );
    // remove stale listeners
    element.removeEventListener(eventName, value);
    const oldValue = element.__eventListenerList.get(eventName)?.at(0);
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
 * @template T
 * Checks if a value is somewhat falsy.
 * @param {T} value
 * @returns {value is undefined | null | false}
 */
function isSomewhatFalsy(value) {
  return value === undefined || value === null || value === false;
}

/**
 * Normalizes a child jsx element for use in the DOM.
 * @param {Node | Array<any> | string | number | boolean | object | undefined | null} child - The child element to normalize.
 * @param {Node} [_parent] - The parent node of the child.
 * @returns {Node} The normalized child element.
 */
export function normalizeJsxChild(child, _parent) {
  if (child instanceof globalThis.window.Node) {
    return child;
  }

  if (Array.isArray(child)) {
    const fragment = globalThis.window.document.createDocumentFragment();

    for (const element of child) {
      fragment.appendChild(normalizeJsxChild(element, fragment));
    }

    return fragment;
  }

  if (child === null || child === undefined) {
    return document.createTextNode('');
  }

  // @ts-ignore: There is an error with the @adbl/cells library. Booleans should be allowed here.
  if (Cell.isCell(child)) {
    const textNode = globalThis.window.document.createTextNode('');
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

  return globalThis.window.document.createTextNode(child?.toString() ?? '');
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
