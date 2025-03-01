import { Modes, setGlobalContext } from '../library/context.js';

//@ts-ignore: Deno has issues with import comments
import { CellSet } from '../library/utils.js';

export class VNode extends EventTarget {
  constructor() {
    super();
    /** @type {VNode[]} */
    this.childNodes = [];
    /** @type {VNode | null} */
    this.parentNode = null;
    this.__isVNode = true;
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

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
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

  /** @returns {VNode | null} */
  get previousSibling() {
    return (
      this.parentNode?.childNodes[
        this.parentNode.childNodes.indexOf(this) - 1
      ] ?? null
    );
  }

  /** @param {(string | VNode)[]} nodes */
  before(...nodes) {
    if (!this.parentNode) return;

    const newNodes = nodes.map((n) => (n instanceof VNode ? n : new VText(n)));
    this.parentNode.childNodes.splice(
      this.parentNode.childNodes.indexOf(this),
      0,
      ...newNodes
    );
    for (const node of newNodes) {
      node.parentNode = this.parentNode;
    }
  }

  /** @param {(string | VNode)[]} nodes */
  after(...nodes) {
    if (!this.parentNode) return;

    const newNodes = nodes.map((n) => (n instanceof VNode ? n : new VText(n)));
    this.parentNode.childNodes.splice(
      this.parentNode.childNodes.indexOf(this) + 1,
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
    if (!this.parentNode) return;

    const newNodes = nodes.map((n) => (n instanceof VNode ? n : new VText(n)));
    const index = this.parentNode.childNodes.indexOf(this);
    this.parentNode.childNodes.splice(1, index, ...newNodes);
    for (const node of newNodes) {
      node.parentNode = this.parentNode;
    }
    this.parentNode = null;
  }

  /** @param {(string | VNode)[]} nodes */
  replaceChildren(...nodes) {
    const newNodes = nodes.map((n) => (n instanceof VNode ? n : new VText(n)));
    this.childNodes.splice(0, this.childNodes.length, ...newNodes);
    for (const node of newNodes) {
      node.parentNode = this;
    }
  }

  /** @param {VNode} child */
  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
  }

  /** @param {(string | VNode)[]} children */
  append(...children) {
    for (const child of children) {
      if (child instanceof VNode) this.appendChild(child);
      else this.appendChild(new VText(child));
    }
  }

  /**
   * @param {(node: VNode) => boolean} predicate
   * @returns {VNode | null}
   */
  findNode(predicate) {
    if (predicate(this)) return this;

    for (const child of this.childNodes) {
      const found = child.findNode(predicate);
      if (found) return found;
    }

    return null;
  }

  /**
   * @param {(node: VNode) => boolean} predicate
   * @returns {VNode[]}
   */
  findNodes(predicate) {
    const nodes = [];
    if (predicate(this)) nodes.push(this);

    for (const child of this.childNodes) {
      const found = child.findNodes(predicate);
      nodes.push(...found);
    }

    return nodes;
  }

  getRelatedCellData() {
    const set = Reflect.get(this, '__attributeCells');
    return /** @type {CellSet | undefined} */ (set);
  }
}

export class VText extends VNode {
  #textContent;
  /** @param {string} text */
  constructor(text) {
    super();
    this.#textContent = text;
  }

  get textContent() {
    return this.#textContent;
  }

  set textContent(value) {
    this.#textContent = value;
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

  /** @param {string} tagName */
  constructor(tagName) {
    super();

    /** @type {VShadowRoot | null} */
    this.shadowRoot = null;
    this.tag = tagName;
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
    this.childNodes = [new MarkupContainerNode(html)];
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

  /** @param {string} name */
  hasAttribute(name) {
    return this.#attributes.has(name);
  }

  /**
   * @param {string} name
   * @param {unknown} value
   */
  setHiddenAttribute(name, value) {
    this.#hiddenAttributes.set(name, value);
  }

  /**
   * @param {string} name
   * @returns {unknown}
   */
  getHiddenAttribute(name) {
    return this.#hiddenAttributes.get(name);
  }

  /**
   * @param {string} name
   */
  removeHiddenAttribute(name) {
    this.#hiddenAttributes.delete(name);
  }

  /**
   * @param {string} qualifiedName
   * @param {boolean} [force]
   */
  toggleAttribute(qualifiedName, force) {
    const shouldSetAttribute =
      (force !== undefined && force) || !this.hasAttribute(qualifiedName);
    if (shouldSetAttribute) {
      this.setAttribute(qualifiedName, '');
    } else {
      this.removeAttribute(qualifiedName);
    }
  }

  get tagName() {
    return this.tag.toUpperCase();
  }

  /** @param {{ mode: string }} options */
  attachShadow({ mode }) {
    this.shadowRoot = new VShadowRoot(mode);
    return this.shadowRoot;
  }

  /** @param {ScrollToOptions} options  */
  scrollTo(options) {
    options;
  }
}

export class VShadowRoot extends VNode {
  /** @param {string} mode */
  constructor(mode) {
    super();
    this.mode = mode;
  }
}

export class VComment extends VNode {
  /** @param {string} text */
  constructor(text) {
    super();
    this.text = text;
  }

  get nodeType() {
    return 8;
  }

  get textContent() {
    return this.text;
  }
}

export class VDocumentFragment extends VNode {
  /** @param {VNode[]} children */
  constructor(children) {
    super();
    this.childNodes = children;
  }

  get nodeType() {
    return 11;
  }
}

export class MarkupContainerNode extends VNode {
  /** @param {string} html */
  constructor(html) {
    super();
    this.html = html;
  }
}

export class VDocument extends VNode {
  constructor() {
    super();
    this.title = '';
    this.documentElement = new VElement('html');
    this.head = new VElement('head');
    this.body = new VElement('body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.head);
    this.appendChild(this.body);
  }

  /** @param {string} text */
  createComment(text) {
    return new VComment(text);
  }

  /** @param {string} tagName */
  createElement(tagName) {
    return new VElement(tagName);
  }

  /**
   * @param {string} tagName
   * @param {string} ns
   */
  createElementNS(ns, tagName) {
    ns;
    return new VElement(tagName);
  }

  /** @param {string} text */
  createTextNode(text) {
    return new VText(text);
  }

  /** @param {string} html */
  createMarkupNode(html) {
    return new MarkupContainerNode(html);
  }

  createDocumentFragment() {
    return new VDocumentFragment([]);
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
 * @param {Node} node
 * @param {VNode} outlet
 * @param {string} path
 */
export async function hydrate(node, outlet, path) {
  setGlobalContext({ mode: Modes.VDom, window: new VWindow() });

  console.log('hydrate', node, 'from', outlet, 'at', path);

  setGlobalContext({ mode: Modes.Interactive, window: globalThis.window });
}
