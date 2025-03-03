//@ts-ignore: Deno has issues with import comments
/** @import { CellSet } from '../library/utils.js' */

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
    return 1;
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
      if (node instanceof VNode) {
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
      if (node instanceof VNode) {
        newNodes.push(node);
      } else {
        newNodes.push(ownerDocument.createTextNode(node));
      }
    }

    const index = parentNode.childNodes.indexOf(this);
    parentNode.childNodes.splice(1, index, ...newNodes);
    for (const node of newNodes) {
      node.parentNode = this.parentNode;
    }
    this.parentNode = null;
  }

  /** @param {(string | VNode)[]} nodes */
  replaceChildren(...nodes) {
    if (!this.ownerDocument) return;

    const { ownerDocument } = this;
    const newNodes = nodes.map((n) =>
      n instanceof VNode ? n : ownerDocument.createTextNode(n)
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
      return this.findNode(
        (node) =>
          node instanceof VElement &&
          node.getAttribute('id') === selector.slice(1)
      );
    }
    const selectorLower = selector.toLowerCase();
    return this.findNode(
      (node) => node.tagName?.toLowerCase() === selectorLower
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
      return this.findNodes(
        (node) =>
          node instanceof VElement &&
          node.getAttribute('id') === selector.slice(1)
      );
    }
    return this.findNodes(
      (node) => node.tagName?.toLowerCase() === selector.toLowerCase()
    );
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

  get textContent() {
    return this.#textContent;
  }

  set textContent(value) {
    this.#textContent = value;
  }

  get tagName() {
    return '#text';
  }

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

  /**
   * @param {string} tagName
   * @param {VDocument} document
   */
  constructor(tagName, document) {
    super(document);

    /** @type {VShadowRoot | null} */
    this.shadowRoot = null;
    this.#tag = tagName;
    this.#attributes = new Map();
    this.#hiddenAttributes = new Map();
    this.classList = new VDomTokenList(this);
    this.scrollLeft = 0;
    this.scrollTop = 0;
  }

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
      this.getAttribute(qualifiedName) === null;
    if (shouldSetAttribute) {
      this.setAttribute(qualifiedName, '');
    } else {
      this.removeAttribute(qualifiedName);
    }
  }

  get tagName() {
    return this.#tag.toUpperCase();
  }

  /** @param {{ mode: string }} options */
  attachShadow({ mode }) {
    if (!this.ownerDocument) {
      console.trace('attachShadow: ownerDocument is null');
      return;
    }
    this.shadowRoot = new VShadowRoot(mode, this.ownerDocument);
    return this.shadowRoot;
  }

  /** @param {ScrollToOptions} options  */
  scrollTo(options) {
    options;
  }
}

export class VShadowRoot extends VNode {
  /**
   * @param {string} mode
   * @param {VDocument} document
   */
  constructor(mode, document) {
    super(document);
    this.mode = mode;
  }

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

  get nodeType() {
    return 8;
  }

  get textContent() {
    return this.text;
  }

  get tagName() {
    return '#comment';
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

  get nodeType() {
    return 11;
  }

  get tagName() {
    return '#document-fragment';
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
   * @param {(node: VNode) => boolean} predicate
   */
  findNode(predicate) {
    return this.documentElement.findNode(predicate);
  }

  /**
   * @param {(node: VNode) => boolean} predicate
   */
  findNodes(predicate) {
    return this.documentElement.findNodes(predicate);
  }

  // NOTE: only supports id and tag selectors.
  /** @param {string} selector */
  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  // NOTE: only supports id and tag selectors.
  /** @param {string} selector */
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

  get tagName() {
    return '#document';
  }

  async mountAllTeleports() {
    console.log('Mounting all teleports...', this.teleportMounts);
    await Promise.all(this.teleportMounts.map((mount) => mount()));
    this.teleportMounts = [];
  }
}

export class VWindow extends EventTarget {
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
    this.sessionStorage = new VSessionStorage();
    this.history = new VHistory(this);
    this.location = new VLocation();
    this.scrollX = 0;
    this.scrollY = 0;
  }

  /** @param {ScrollToOptions} options  */
  scrollTo(options) {
    options;
  }
}

/** @implements {Storage} */
export class VSessionStorage {
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
