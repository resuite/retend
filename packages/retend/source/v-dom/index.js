/** @import { CellSet } from '../library/utils.js' */
/** @import { Router } from '../router/index.js'; **/

import { CustomEvent, Modes } from '../context/index.js';

export class VNode extends EventTarget {
  /** @param {VDocument | null} document */
  constructor(document) {
    super();
    /** @type {VNode[]} */
    this.childNodes = [];
    /** @type {VNode | null} */
    this.parentNode = null;
    this.__isVNode = true;
    this.ownerDocument = document;
  }

  static ELEMENT_NODE = 1;
  static ATTRIBUTE_NODE = 2;
  static TEXT_NODE = 3;
  static CDATA_SECTION_NODE = 4;
  static ENTITY_REFERENCE_NODE = 5;
  static ENTITY_NODE = 6;
  static PROCESSING_INSTRUCTION_NODE = 7;
  static COMMENT_NODE = 8;
  static DOCUMENT_NODE = 9;
  static DOCUMENT_TYPE_NODE = 10;
  static DOCUMENT_FRAGMENT_NODE = 11;
  static NOTATION_NODE = 12;

  get nodeType() {
    return 0;
  }

  /** @returns {string | null} */
  get tagName() {
    return null;
  }

  /** @returns {string | null} */
  get textContent() {
    const subClass = this.constructor.name;
    throw new Error(`textContent() is not implemented for ${subClass}`);
  }

  /** @returns {VNode | null} */
  get nextSibling() {
    return (
      this.parentNode?.childNodes[
        this.parentNode.childNodes.indexOf(this) + 1
      ] ?? null
    );
  }

  /** @param {(string | VNode)[]} nodes */
  after(...nodes) {
    if (!this.parentNode || !this.ownerDocument) return;
    const { ownerDocument, parentNode } = this;

    const newNodes = [];
    for (const node of nodes) {
      if (node instanceof VDocumentFragment) {
        newNodes.push(...node.childNodes);
      } else if (node instanceof VNode) {
        newNodes.push(node);
      } else {
        newNodes.push(ownerDocument.createTextNode(node));
      }
    }
    parentNode.childNodes.splice(
      parentNode.childNodes.indexOf(this) + 1,
      0,
      ...newNodes
    );
    for (const node of newNodes) {
      node.remove();
      node.parentNode = this.parentNode;
    }
  }

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.childNodes.indexOf(this);
    this.parentNode.childNodes.splice(index, 1);
    this.parentNode = null;
  }

  /** @param {(string | VNode)[]} nodes */
  replaceWith(...nodes) {
    if (!this.parentNode || !this.ownerDocument) return;

    const { ownerDocument, parentNode } = this;
    const newNodes = [];
    for (const node of nodes) {
      if (node instanceof VDocumentFragment) {
        newNodes.push(...node.childNodes);
      } else if (node instanceof VNode) {
        newNodes.push(node);
      } else {
        newNodes.push(ownerDocument.createTextNode(node));
      }
    }

    const index = parentNode.childNodes.indexOf(this);
    parentNode.childNodes.splice(index, 1, ...newNodes);
    for (const node of newNodes) {
      node.parentNode = this.parentNode;
    }
    this.parentNode = null;
  }

  /** @param {(string | VNode)[]} nodes */
  replaceChildren(...nodes) {
    if (!this.ownerDocument) return;

    const { ownerDocument } = this;
    const newNodes = nodes.flatMap((n) =>
      n instanceof VDocumentFragment
        ? n.childNodes
        : n instanceof VNode
          ? n
          : ownerDocument.createTextNode(n)
    );
    for (const node of this.childNodes) {
      node.parentNode = null;
    }
    this.childNodes.splice(0, this.childNodes.length, ...newNodes);
    for (const node of newNodes) {
      node.parentNode = this;
    }
  }

  /** @param {(string | VNode)[]} children */
  append(...children) {
    if (!this.ownerDocument) return;

    for (const child of children) {
      if (child instanceof VNode) {
        child.remove();
      }

      if (child instanceof VDocumentFragment) {
        const nodes = [...child.childNodes];
        for (const childNode of nodes) {
          childNode.remove();
          childNode.parentNode = this;
          this.childNodes.push(childNode);
        }
      } else if (child instanceof VNode) {
        child.parentNode = this;
        this.childNodes.push(child);
      } else {
        const text = this.ownerDocument.createTextNode(child);
        text.parentNode = this;
        this.childNodes.push(text);
      }
    }
  }

  /**
   * @template R
   * @param {(node: VNode) => boolean} predicate
   * @returns {R | null}
   */
  findNode(predicate) {
    // @ts-ignore: The predicate function is generic.
    if (predicate(this)) return this;

    for (const child of this.childNodes) {
      const found = child.findNode(predicate);
      // @ts-ignore: The predicate function is generic.
      if (found) return found;
    }

    return null;
  }

  /**
   * @template R
   * @param {(node: VNode) => boolean} predicate
   * @returns {R[]}
   */
  findNodes(predicate) {
    const nodes = [];
    if (predicate(this)) nodes.push(this);

    for (const child of this.childNodes) {
      const found = child.findNodes(predicate);
      nodes.push(...found);
    }

    // @ts-ignore: The predicate function is generic.
    return nodes;
  }

  // NOTE: only supports id and tag selectors.
  /**
   * @param {string} selector
   * @returns {VElement | null}
   */
  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.findNode(
        (node) =>
          node !== this &&
          node instanceof VElement &&
          node.getAttribute('id') === id
      );
    }
    const selectorLower = selector.toLowerCase();
    return this.findNode(
      (node) => node !== this && node.tagName?.toLowerCase() === selectorLower
    );
  }

  // NOTE: only supports id and tag selectors.
  /**
   * @param {string} selector
   * @returns {VElement[]}
   */
  querySelectorAll(selector) {
    if (typeof selector !== 'string') return [];
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.findNodes(
        (node) =>
          node !== this &&
          node instanceof VElement &&
          node.getAttribute('id') === id
      );
    }
    const selectorLower = selector.toLowerCase();
    return this.findNodes((node) => {
      return (
        node !== this &&
        node instanceof VElement &&
        node.tagName?.toLowerCase() === selectorLower
      );
    });
  }

  getRelatedCellData() {
    const set = Reflect.get(this, '__attributeCells');
    return /** @type {CellSet | undefined} */ (set);
  }

  get isConnected() {
    if (!this.ownerDocument) return false;

    const { ownerDocument } = this;
    let parent = this.parentNode;
    while (parent) {
      if (parent === ownerDocument.documentElement) return true;
      parent = parent.parentNode;
    }
    return false;
  }
}

export class VText extends VNode {
  #textContent;
  /**
   * @param {string} text
   * @param {VDocument} document
   */
  constructor(text, document) {
    super(document);
    this.#textContent = text;
  }

  /** @override */
  get textContent() {
    return this.#textContent;
  }

  /** @override */
  set textContent(value) {
    this.#textContent = value;
  }

  /** @override */
  get tagName() {
    return '#text';
  }

  /** @override */
  get nodeType() {
    return 3;
  }
}

export class VDomTokenList {
  /** @param {VElement} element */
  constructor(element) {
    this.element = element;
  }

  /** @param {string[]} tokens */
  add(...tokens) {
    const className = this.element.getAttribute('class') ?? '';
    const newClassName = [...className.split(' '), ...tokens].join(' ');
    this.element.setAttribute('class', newClassName);
  }

  /** @param {string[]} tokens */
  remove(...tokens) {
    const className = this.element.getAttribute('class') ?? '';
    const newClassName = className
      .split(' ')
      .filter((c) => !tokens.includes(c))
      .join(' ');
    this.element.setAttribute('class', newClassName);
  }
}

export class VElement extends VNode {
  /** @type {Map<string, string>} */
  #attributes;
  /** @type {Map<string, any>} */
  #hiddenAttributes;
  /** @type {string} */
  #tag;
  /** @type {VShadowRoot | null} */
  #shadowRoot;

  /**
   * @param {string} tagName
   * @param {VDocument} document
   */
  constructor(tagName, document) {
    super(document);

    this.#shadowRoot = null;
    this.#tag = tagName;
    this.#attributes = new Map();
    this.#hiddenAttributes = new Map();
    this.classList = new VDomTokenList(this);
    this.scrollLeft = 0;
    this.scrollTop = 0;
  }

  /** @override */
  get nodeType() {
    return 1;
  }

  get attributes() {
    return [...this.#attributes.entries()].map(([key, value]) => ({
      name: key,
      value,
    }));
  }

  get hiddenAttributes() {
    return this.#hiddenAttributes;
  }

  /** @param {string} html */
  set innerHTML(html) {
    for (const node of this.childNodes) {
      node.parentNode = null;
    }
    if (!this.ownerDocument) {
      console.trace(
        'Tried to set innerHTML on a node without an ownerDocument'
      );
      return;
    }
    this.childNodes = [new MarkupContainerNode(html, this.ownerDocument)];
  }

  /** @param {string} name */
  getAttribute(name) {
    return this.#attributes.get(name) ?? null;
  }

  /**
   * @param {string} name
   *  @param {string} value
   */
  setAttribute(name, value) {
    this.#attributes.set(name, value);
  }

  /** @param {string} name */
  removeAttribute(name) {
    this.#attributes.delete(name);
  }

  /**
   * @param {string} name
   * @param {unknown} value
   */
  setHiddenAttribute(name, value) {
    this.#hiddenAttributes.set(name, value);
  }

  /**
   * @param {string} qualifiedName
   * @param {boolean} [force]
   */
  toggleAttribute(qualifiedName, force) {
    const shouldSetAttribute =
      (force !== undefined && force) ||
      (force === undefined && this.getAttribute(qualifiedName) === null);
    if (shouldSetAttribute) {
      this.setAttribute(qualifiedName, '');
    } else {
      this.removeAttribute(qualifiedName);
    }
  }

  /** @override */
  get tagName() {
    return this.#tag.toUpperCase();
  }

  /** @param {{ mode: ShadowRootMode}} options */
  attachShadow({ mode }) {
    if (!this.ownerDocument) {
      throw new Error(
        'Cannot attach shadow to a node without an ownerDocument'
      );
    }
    this.#shadowRoot = new VShadowRoot(mode, this.ownerDocument);
    return this.#shadowRoot;
  }

  /** @param {ScrollToOptions} options  */
  scrollTo(options) {
    options;
  }

  get shadowRoot() {
    if (!this.#shadowRoot) return null;

    if (this.#shadowRoot.mode === 'closed') return null;
    return this.#shadowRoot;
  }
}

export class VDocumentFragment extends VNode {
  /**
   * @param {VNode[]} children
   * @param {VDocument} document
   */
  constructor(children, document) {
    super(document);
    this.childNodes = children;
  }

  /** @override */
  get nodeType() {
    return 11;
  }

  /** @override */
  get tagName() {
    return '#document-fragment';
  }
}

export class VShadowRoot extends VDocumentFragment {
  /**
   * @param {string} mode
   * @param {VDocument} document
   */
  constructor(mode, document) {
    super([], document);
    this.mode = mode;
  }

  /** @override */
  get tagName() {
    return '#shadow-root';
  }
}

export class VComment extends VNode {
  /**
   * @param {string} text
   * @param {VDocument} document
   */
  constructor(text, document) {
    super(document);
    this.text = text;
  }

  /** @override */
  get nodeType() {
    return 8;
  }

  /** @override */
  get textContent() {
    return this.text;
  }

  /** @override */
  get tagName() {
    return '#comment';
  }
}

export class MarkupContainerNode extends VNode {
  /**
   * @param {string} html
   * @param {VDocument} document
   */
  constructor(html, document) {
    super(document);
    this.html = html;
  }

  /** @override */
  get tagName() {
    return '#markup-container';
  }
}

export class VDocument extends VNode {
  constructor() {
    super(null);
    this.title = '';
    this.documentElement = this.createElement('html');
    this.head = this.createElement('head');
    this.body = this.createElement('body');
    this.documentElement.append(this.head, this.body);
    /** @type {Array<() => Promise<*>>} */
    this.teleportMounts = [];
    /** @type {Router | null} */
    this.__appRouterInstance = null;
  }

  /** @param {string} text */
  createComment(text) {
    return new VComment(text, this);
  }

  /** @param {string} tagName */
  createElement(tagName) {
    return new VElement(tagName, this);
  }

  /**
   * @override
   * @param {(node: VNode) => boolean} predicate
   */
  findNode(predicate) {
    return this.documentElement.findNode(predicate);
  }

  /**
   * @override
   * @param {(node: VNode) => boolean} predicate
   */
  findNodes(predicate) {
    return this.documentElement.findNodes(predicate);
  }

  // NOTE: only supports id and tag selectors.
  /**
   * @override
   * @param {string} selector
   */
  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  // NOTE: only supports id and tag selectors.
  /**
   * @override
   * @param {string} selector
   */
  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }

  /**
   * @param {string} tagName
   * @param {string} _ns
   */
  createElementNS(_ns, tagName) {
    return new VElement(tagName, this);
  }

  /** @param {string} text */
  createTextNode(text) {
    return new VText(text, this);
  }

  /** @param {string} html */
  createMarkupNode(html) {
    return new MarkupContainerNode(html, this);
  }

  createDocumentFragment() {
    return new VDocumentFragment([], this);
  }

  /** @override */
  get tagName() {
    return '#document';
  }

  async mountAllTeleports() {
    await Promise.all(this.teleportMounts.map((mount) => mount()));
    this.teleportMounts = [];
  }
}

export class VWindow extends EventTarget {
  #timeouts = new Set();
  #intervals = new Set();
  __appRenderMode__ = Modes.VDom;

  constructor() {
    super();
    this.document = new VDocument();
    this.HTMLElement = VElement;
    this.Element = VElement;
    this.DocumentFragment = VDocumentFragment;
    this.Comment = VComment;
    this.Document = VDocument;
    this.ShadowRoot = VShadowRoot;
    this.Node = VNode;
    this.MarkupContainerNode = MarkupContainerNode;
    this.sessionStorage = new VStorage();
    this.localStorage = new VStorage();
    this.history = new VHistory(this);
    this.location = new VLocation();
    this.scrollX = 0;
    this.scrollY = 0;
    this.innerWidth = 0;
    this.innerHeight = 0;
  }

  /**
   *
   * @param {() => void} callback
   * @param {number} delay
   * @param  {...any} args
   * @returns {ReturnType<typeof setTimeout>}
   */
  setTimeout(callback, delay, ...args) {
    const timeout = setTimeout(callback, delay, ...args);
    this.#timeouts.add(timeout);
    return timeout;
  }

  /**
   *
   * @param {() => void} callback
   * @param {number} delay
   * @param  {...any} args
   * @returns {ReturnType<typeof setInterval>}
   */
  setInterval(callback, delay, ...args) {
    const interval = setInterval(callback, delay, ...args);
    this.#intervals.add(interval);
    return interval;
  }

  /**
   * @param {ReturnType<typeof setTimeout>} timeout
   */
  clearTimeout(timeout) {
    this.#timeouts.delete(timeout);
    clearTimeout(timeout);
  }

  /**
   * @param {ReturnType<typeof setInterval>} interval
   */
  clearInterval(interval) {
    this.#intervals.delete(interval);
    clearInterval(interval);
  }

  /** @param {ScrollToOptions} options  */
  scrollTo(options) {
    options;
  }

  close() {
    for (const timeout of this.#timeouts) {
      clearTimeout(timeout);
    }
    for (const interval of this.#intervals) {
      clearInterval(interval);
    }
    this.#timeouts.clear();
    this.#intervals.clear();
  }
}

/** @implements {Storage} */
export class VStorage {
  #values = new Map();

  get length() {
    return this.#values.size;
  }

  /** @type {Storage['key']} */
  key(index) {
    return [...this.#values.keys()][index] ?? null;
  }

  /** @type {Storage['setItem']} */
  setItem(key, value) {
    this.#values.set(key, value);
  }

  /** @type {Storage['getItem']} */
  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  clear() {
    this.#values.clear();
  }

  /** @type {Storage['removeItem']} */
  removeItem(key) {
    this.#values.delete(key);
  }
}

export class VHistory {
  /**@type {Array<string | URL | null | undefined>} */
  #log;
  /**@type {number} */
  #cursor;
  /** @type {VWindow} */
  #window;

  /** @param {VWindow} window */
  constructor(window) {
    this.#log = [];
    this.#cursor = 0;
    this.#window = window;
  }

  /** @type {History['go']} */
  go(delta) {
    if (!delta) {
      this.#window.dispatchEvent(new Event('popstate'));
      return;
    }

    this.#cursor += delta;
    this.#window.location.href = String(this.#log[this.#cursor] || '/');
    this.#window.dispatchEvent(new Event('popstate'));
  }

  /** @type {History['replaceState']} */
  replaceState(_data, _unused, path) {
    this.#log[this.#cursor] = path;
    this.#window.location.href = String(path || '/');
    this.#window.dispatchEvent(new Event('popstate'));
  }

  /** @type {History['pushState']} */
  pushState(_data, _unused, path) {
    this.#log[++this.#cursor] = path;
    this.#window.location.href = String(path || '/');
    this.#window.dispatchEvent(new Event('popstate'));
  }

  back() {
    this.#cursor = Math.max(this.#cursor - 1, 0);
    this.#window.location.href = String(this.#log[this.#cursor] || '/');
    this.#window.dispatchEvent(new Event('popstate'));
  }

  get length() {
    return this.#cursor + 1;
  }
}
export class VLocation {
  /** @type {string} */
  #href;
  /** @type {string} */
  #search;
  /** @type {string} */
  #hash;
  /** @type {string} */
  #pathname;

  constructor() {
    this.#href = '';
    this.#search = '';
    this.#hash = '';
    this.#pathname = '/';
  }

  get href() {
    return this.#href;
  }

  set href(value) {
    this.#href = value;
    const url = new URL(value, 'http://localhost');
    this.#pathname = url.pathname;
    this.#search = url.search;
    this.#hash = url.hash;
  }

  get search() {
    return this.#search;
  }

  set search(value) {
    this.#search = value.startsWith('?') ? value : `?${value}`;
    this.#updateHref();
  }

  get hash() {
    return this.#hash;
  }

  set hash(value) {
    this.#hash = value.startsWith('#') ? value : `#${value}`;
    this.#updateHref();
  }

  get pathname() {
    return this.#pathname;
  }

  set pathname(value) {
    this.#pathname = value.startsWith('/') ? value : `/${value}`;
    this.#updateHref();
  }

  #updateHref() {
    this.#href = `${this.#pathname}${this.#search}${this.#hash}`;
  }
}

/**
 * @typedef {Object} HydrationUpgradeEventDetail
 * @property {Node} newInstance
 */

/**
 * An event that can be dispatched when a virtual node is upgraded to a real DOM node.
 * @extends {CustomEvent<HydrationUpgradeEventDetail>}
 */
export class HydrationUpgradeEvent extends CustomEvent {
  /** @param {Node} newInstance */
  constructor(newInstance) {
    super('hydrationupgrade', { detail: { newInstance } });
  }
}
