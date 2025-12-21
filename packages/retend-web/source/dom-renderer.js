/** @import { Observer, ReconcilerOptions, Renderer } from "retend"; */
/** @import { jsxDevFileData, UpdatableFn } from 'retend/hmr'; */
/** @import { ConnectedComment, HiddenElementProperties } from './utils.js'; */

import { Cell, createNodesFromTemplate } from 'retend';
import { withHMRBoundaries } from './plugin/hmr.js';
import * as Ops from './dom-ops.js';

/**
 * @typedef {Element & HiddenElementProperties} JsxElement
 * @typedef {[ConnectedComment, ConnectedComment]} DOMHandle
 * @typedef {Renderer<DOMRenderingTypes>} DOMRendererInterface
 * @typedef {{ childNodes: Node[], shadowRoot: ShadowRoot | null, data: any }} SavedInstance
 */

/**
 * @typedef DOMRenderingTypes
 * @property {Node} Output
 * @property {Node} Node
 * @property {Node} Text
 * @property {DOMHandle} Handle
 * @property {DocumentFragment} Group
 * @property {JsxElement} Container
 * @property {Window} Host
 * @property {SavedInstance} SavedNodeState
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
  /** @type {Window & globalThis} */
  host;
  observer = null;

  /** @param {Window & globalThis} host */
  constructor(host) {
    this.host = host;
    Ops.writeStaticStyles(this);
    this.capabilities = {
      supportsSetupEffects: true,
      supportsObserverConnectedCallbacks: true,
    };
  }

  /**
   * @param {Node} node
   */
  isActive(node) {
    return node.isConnected;
  }

  /** @param {() => void} processor  */
  onViewChange(processor) {
    const mutObserver = new this.host.MutationObserver(processor);
    mutObserver.observe(window.document.body, {
      subtree: true,
      childList: true,
    });
  }

  /** @param {string} key */
  selectMatchingNodes(key) {
    return [...this.host.document.querySelectorAll(key)];
  }

  /** @param {string} key */
  selectMatchingNode(key) {
    return this.host.document.querySelector(key);
  }

  /**
   * @param {Node} node
   * @param {any} data
   * @returns {SavedInstance}
   */
  saveContainerState(node, data) {
    return Ops.saveContainerState(node, data, this);
  }

  /**
   * @param {JsxElement} node
   * @param {SavedInstance} data
   */
  restoreContainerState(node, data) {
    return Ops.restoreContainerState(node, data, this);
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
    /** @type {Node[]} */
    const nodes = createNodesFromTemplate(component, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  /**
   * @param {Node} _parentNode
   * @param {Node | Node[]} childNode
   */
  append(_parentNode, childNode) {
    const parentNode = /** @type {Element} */ (_parentNode);
    const shadowRoot = Ops.appendShadowRoot(parentNode, childNode, this);
    if (shadowRoot) {
      return shadowRoot;
    }
    const tagname = parentNode.tagName;

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
      (tagname === 'svg' || tagname === 'math') &&
      childNode instanceof this.host.HTMLElement
    ) {
      const elementNamespace =
        parentNode.namespaceURI ?? 'http://www.w3.org/1999/xhtml';
      const temp = this.host.document.createElementNS(elementNamespace, 'div');
      temp.innerHTML = /** @type {HTMLElement} */ (childNode).outerHTML;
      parentNode.append(...temp.children);
      return parentNode;
    }
    if (Array.isArray(childNode)) {
      const children = childNode.filter(Boolean);
      parentNode.append(...children);
    } else {
      parentNode.append(childNode);
    }

    return parentNode;
  }

  /**
   * @param {Promise<any>} child
   * @returns {Node}
   */
  handlePromise(child) {
    return Ops.handlePromise(child, this);
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
   * @param {Node} node
   */
  finalize(node) {
    return node;
  }

  /**
   * @param {Node | Node[]} [input]
   * @returns {DocumentFragment}
   */
  createGroup(input) {
    return Ops.createGroup(input, this);
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
   */
  createContainer(tagname, props) {
    const defaultNamespace = props?.xmlns ?? 'http://www.w3.org/1999/xhtml';

    let ns;
    if (tagname === 'svg') {
      ns = 'http://www.w3.org/2000/svg';
    } else if (tagname === 'math') {
      ns = 'http://www.w3.org/1998/Math/MathML';
    } else {
      ns = defaultNamespace;
    }

    /** @type {JsxElement} */ // @ts-expect-error
    const element = this.host.document.createElementNS(ns, tagname);
    element.__eventListenerList = new Map();
    element.__attributeCells = new Set();
    return element;
  }

  /**
   * @param {string | Cell<any>} text
   */
  createText(text) {
    return Ops.createText(text, this);
  }

  /**
   * @param {Node} node
   * @returns {node is DocumentFragment}
   */
  isGroup(node) {
    return (
      node instanceof this.host.DocumentFragment &&
      !('__isShadowRootContainer' in node)
    );
  }

  /**
   * @param {any} child
   * @returns {child is Node}
   */
  isNode(child) {
    return child instanceof this.host.Node;
  }

  /**
   * @param {(node: Node) => void} callback
   * @param {Observer} observer
   */
  scheduleTeleport(callback, observer) {
    const anchorNode = window.document.createComment('teleport-anchor');
    const ref = Cell.source(anchorNode);
    observer.onConnected(ref, () => callback(anchorNode));
    return anchorNode;
  }
}
