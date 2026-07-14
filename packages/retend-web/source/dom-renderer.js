/** @import { Observer, ReconcilerOptions, Renderer, __HMR_UpdatableFn, Scope, StateSnapshot } from "retend"; */
/** @import { JSX } from 'retend/jsx-runtime'; */
/** @import { ConnectedComment, HiddenElementProperties } from './utils.js'; */

import {
  Cell,
  branchState,
  createNodesFromTemplate,
  createScope,
  normalizeJsxChild,
  withState,
  onConnected,
  setActiveRenderer,
  runPendingSetupEffects,
  useScopeContext,
} from 'retend';

import * as Ops from './dom-ops.js';
import { withHMRBoundaries } from './plugins/hmr.js';

const DOCUMENT_FRAGMENT_NODE = 11;
/** @type {Scope<string>} */
const NamespaceScope = createScope('retend-web:Namespace');
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MATH_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';

/**
 * @typedef {Element & HiddenElementProperties} JsxElement
 * @typedef {[ConnectedComment, ConnectedComment]} DOMHandle
 * @typedef {Renderer<DOMRenderingTypes>} DOMRendererInterface
 */

/**
 * @typedef DOMRenderingTypes
 * @property {Node} Node
 * @property {Node} Text
 * @property {DOMHandle} Handle
 * @property {DocumentFragment} Group
 * @property {JsxElement} Container
 * @property {Window} Host
 */

/**
 * A concrete implementation of the {@link Renderer} interface for web-based environments.
 *
 * This renderer bridges the Retend framework's reactive logic with the standard Web DOM API,
 * supporting both real browser environments and the framework's own virtual DOM implementation.
 * It manages node creation, reconciliation, and lifecycle events specifically for HTML/SVG/MathML
 * elements while remaining compatible with standard web window and document structures.
 *
 * @class
 * @implements {DOMRendererInterface}
 */
export class DOMRenderer {
  /** @type {Window} */
  host;
  /** @type {Observer | null} */
  observer = null;
  staticStyleIds = new Set();

  #savedHandles = new Map();
  #savedHandleId = 0;

  /** @param {Window} host */
  constructor(host) {
    this.host = host;
    Ops.writeStaticStyles(this);
    this.capabilities = {
      supportsSetupEffects: true,
      supportsObserverConnectedCallbacks: true,
    };
  }

  /**
   * @param {JSX.Template} app
   * @returns {Node | Node[]}
   */
  render(app) {
    return normalizeJsxChild(app, this);
  }

  /**
   * @param {Node} node
   */
  isActive(node) {
    return node.isConnected;
  }

  /**
   * @param {DocumentFragment} fragment
   * @returns {DOMHandle}
   */
  createGroupHandle(fragment) {
    return Ops.createGroupHandle(fragment, this);
  }

  /**
   * @param {DOMHandle} segment
   * @param {Node[]} newContent
   */
  write(segment, newContent) {
    return Ops.write(segment, newContent);
  }

  /**
   * @param {DOMHandle} handle
   * @returns {number}
   */
  save(handle) {
    const id = this.#savedHandleId++;
    const nodes = [];
    let node = handle[0].nextSibling;
    while (node && node !== handle[1]) {
      nodes.push(node);
      node = node.nextSibling;
    }
    this.#savedHandles.set(id, nodes);
    return id;
  }

  /**
   * @param {number} id
   * @param {DOMHandle | null} handle
   */
  restore(id, handle) {
    const nodes = this.#savedHandles.get(id);
    if (!nodes) return;
    this.#savedHandles.delete(id);
    if (handle) this.write(handle, nodes);
  }

  /**
   * @param {DOMHandle} segment
   * @param {ReconcilerOptions<Node>} options
   */
  reconcile(segment, options) {
    return Ops.reconcile(segment, options, this);
  }

  /**
   * @template {Node} N
   * @param {N} node
   * @param {string} key
   * @param {any} value
   * @returns {N}
   */
  setProperty(node, key, value) {
    return Ops.setProperty(node, key, value);
  }

  /**
   * @param {__HMR_UpdatableFn} tagname
   * @param {any[]} props
   * @param {StateSnapshot} [_]
   * @param {JSX.JSXDevFileData} [fileData]
   * @returns {Node | Node[]}
   */
  handleComponent(tagname, props, _, fileData) {
    // @ts-expect-error: Vite types are not ingrained
    if (import.meta.env?.DEV) {
      return withHMRBoundaries(tagname, props, fileData, this);
    }
    // @ts-expect-error: Rspack types are not ingrained
    if (import.meta.webpackHot) {
      return withHMRBoundaries(tagname, props, fileData, this);
    }
    const template = tagname(...props);
    const nodes = createNodesFromTemplate(template, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  /**
   * @param {Node} _parentNode
   * @param {Node | Node[]} childNode
   */
  append(_parentNode, childNode) {
    const parentNode = /** @type {Element} */ (_parentNode);
    const shadowRoot = Ops.appendShadowRoot(parentNode, childNode, this);
    if (shadowRoot) return shadowRoot;

    if (Array.isArray(childNode)) {
      const children = childNode.filter(Boolean);
      parentNode.append(...children);
    } else {
      parentNode.append(childNode);
    }

    return parentNode;
  }

  /**
   * @param {string} text
   * @param {Node} node
   * @returns {Node}
   */
  updateText(text, node) {
    return Ops.updateText(text, node);
  }

  /**
   * @returns {DocumentFragment}
   */
  createGroup() {
    return this.host.document.createDocumentFragment();
  }

  /**
   * @param {any} group
   * @returns {Node[]}
   */
  unwrapGroup(group) {
    return Array.from(group.childNodes);
  }

  /**
   * @param {string} tagname
   * @param {any} [props]
   * @returns {JsxElement}
   */
  createContainer(tagname, props) {
    let inheritedNamespace = HTML_NAMESPACE;
    try {
      inheritedNamespace = useScopeContext(NamespaceScope);
    } catch {}

    const defaultNamespace = props?.xmlns ?? inheritedNamespace;
    let ns;
    if (tagname === 'svg') ns = SVG_NAMESPACE;
    else if (tagname === 'math') ns = MATH_NAMESPACE;
    else if (tagname === 'retend-teleport') ns = HTML_NAMESPACE;
    else ns = defaultNamespace;

    if (
      props &&
      props.xmlns === undefined &&
      (tagname === 'svg' || tagname === 'math')
    ) {
      props.xmlns = ns;
    }

    if (props && tagname !== 'retend-teleport' && 'children' in props) {
      const childNamespace = tagname === 'foreignObject' ? HTML_NAMESPACE : ns;
      const children = props.children;
      props.children = () =>
        NamespaceScope.Provider({
          value: childNamespace,
          children: () => children,
          h: false,
        });
    }

    const element = /** @type {JsxElement} */ (
      /** @type {unknown} */ (this.host.document.createElementNS(ns, tagname))
    );
    return element;
  }

  /**
   * @param {string} text
   * @returns {Text}
   */
  createText(text) {
    return this.host.document.createTextNode(text);
  }

  /**
   * @param {Node} node
   * @returns {node is DocumentFragment}
   */
  isGroup(node) {
    return node?.nodeType === DOCUMENT_FRAGMENT_NODE;
  }

  /**
   * @param {any} child
   * @returns {child is Node}
   */
  isNode(child) {
    return child instanceof Node || child instanceof Ops.ShadowRootFragment;
  }

  /**
   * @param {(node?: Node) => Promise<*>} callback
   */
  scheduleTeleport(callback) {
    const anchorNode = this.host.document.createComment('teleport-anchor');
    const ref = Cell.source(anchorNode);
    const snapshot = branchState();
    onConnected(ref, (node) => withState(snapshot, () => callback(node)));
    return anchorNode;
  }

  enableHydrationMode() {}

  async endHydration() {}
}

/**
 * Renders the provided JSX application to the specified DOM element.
 *
 * Initializes the DOM renderer context, renders the application tree, appends the resulting
 * nodes to the target element, and executes any pending setup effects.
 *
 * @param {Element | ShadowRoot} element - The target DOM element to mount the application into.
 * @param {() => JSX.Template} App - A function that returns the template to be rendered.
 */
export function renderToDOM(element, App) {
  const renderer = new DOMRenderer(window);
  setActiveRenderer(renderer);
  const root = renderer.render(App);
  element.append(...(Array.isArray(root) ? root : [root]));
  runPendingSetupEffects();
}
