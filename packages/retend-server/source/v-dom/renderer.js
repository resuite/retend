/** @import { Renderer, ReconcilerOptions, __HMR_UpdatableFn } from "retend"; */
/** @import * as VDom from './index.js' */

import { createNodesFromTemplate, Cell } from 'retend';
import * as Ops from 'retend-web/dom-ops';

/**
 * @typedef {VDom.VElement & { __attributeCells: any,__eventListenerList?: Map<any, any> }} JsxElement
 * @typedef {[VDom.VComment, VDom.VComment]} DOMHandle
 * @typedef {Renderer<VDOMRenderingTypes>} VDOMRendererInterface
 * @typedef {{ childNodes: VDom.VNode[], shadowRoot: VDom.VShadowRoot | null, data: any }} SavedInstance
 */

/**
 * @typedef VDOMRenderingTypes
 * @property {VDom.VNode} Output
 * @property {VDom.VNode} Node
 * @property {VDom.VNode} Text
 * @property {DOMHandle} Handle
 * @property {VDom.VDocumentFragment} Group
 * @property {JsxElement} Container
 * @property {VDom.VWindow} Host
 * @property {SavedInstance} SavedNodeState
 */

/**
 * A specialized implementation of the {@link Renderer} interface for server-side
 * and virtual DOM environments.
 *
 * This renderer implements the Retend framework's rendering logic using a lightweight,
 * platform-agnostic virtual DOM. It is designed for environments where a real browser
 * DOM is not available, such as Server-Side Rendering (SSR) or unit testing in Node.js.
 * It provides the necessary hooks for node creation and reconciliation while maintaining
 * a level of compatibility with standard web-like structures.
 *
 * @class
 * @implements {VDOMRendererInterface}
 */
export class VDOMRenderer {
  observer = null;
  staticStyleIds = new Set();
  markDynamicNodes = false;
  #dynamicNodeMarker = 0;

  /** @param {VDom.VWindow} host */
  constructor(host, { markDynamicNodes } = { markDynamicNodes: false }) {
    this.host = host;
    this.markDynamicNodes = markDynamicNodes;
    // @ts-expect-error: all static styles need is staticStyleIds set and a window
    Ops.writeStaticStyles(this);
    this.capabilities = {
      supportsSetupEffects: false,
      supportsObserverConnectedCallbacks: false,
    };
  }

  isActive() {
    return false;
  }

  onViewChange() {}

  /** @param {string} key */
  selectMatchingNodes(key) {
    return [...this.host.document.querySelectorAll(key)];
  }

  /** @param {string} key */
  selectMatchingNode(key) {
    return this.host.document.querySelector(key);
  }

  /**
   * @param {VDom.VNode} node
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
   * @param {VDom.VDocumentFragment} fragment
   * @returns {DOMHandle}
   */
  createGroupHandle(fragment) {
    return Ops.createGroupHandle(fragment, this);
  }

  /**
   * @param {DOMHandle} segment
   * @param {VDom.VNode[]} newContent
   */
  write(segment, newContent) {
    return Ops.write(segment, newContent);
  }

  /**
   * @param {DOMHandle} segment
   * @param {ReconcilerOptions<VDom.VNode>} options
   */
  reconcile(segment, options) {
    return Ops.reconcile(segment, options, this);
  }

  /**
   * @template {VDom.VNode} N
   * @param {N} node
   * @param {string} key
   * @param {any} value
   * @returns {N}
   */
  setProperty(node, key, value) {
    // event listeners are not needed in the vdom.
    if (key.startsWith('on') && key.length > 2) {
      // @ts-expect-error
      node.__hasEventListeners = true;
      return node;
    }
    return Ops.setProperty(node, key, value);
  }

  /**
   * @param {__HMR_UpdatableFn} tagname
   * @param {any} props
   */
  handleComponent(tagname, props) {
    const component = tagname(...props);
    /** @type {VDom.VNode[]} */
    const nodes = createNodesFromTemplate(component, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  /**
   * @param {VDom.VNode} parentNode
   * @param {VDom.VNode | VDom.VNode[]} childNode
   */
  append(parentNode, childNode) {
    const shadowRoot = Ops.appendShadowRoot(parentNode, childNode, this);
    if (shadowRoot) {
      return shadowRoot;
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
   * @returns {VDom.VNode}
   */
  handlePromise(child) {
    return Ops.handlePromise(child, this);
  }

  /**
   * @param {string} text
   * @param {VDom.VNode} node
   */
  updateText(text, node) {
    return Ops.updateText(text, node);
  }

  /**
   * @param {VDom.VNode} node
   */
  finalize(node) {
    return node;
  }

  /**
   * @param {VDom.VNode | VDom.VNode[]} [input]
   * @returns {VDom.VDocumentFragment}
   */
  createGroup(input) {
    return Ops.createGroup(input, this);
  }

  /**
   * @param {any} group
   * @returns {VDom.VNode[]}
   */
  unwrapGroup(group) {
    return Array.from(group.childNodes);
  }

  /**
   * @param {string} tagname
   * @param {any} [props]
   */
  createContainer(tagname, props) {
    /** @type {JsxElement} */ // @ts-expect-error
    const element = this.host.document.createElement(tagname);
    if (this.markDynamicNodes && isDynamicContainer(tagname, props)) {
      element.setAttribute('data-dyn', String(this.#dynamicNodeMarker++));
    }
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
   * @returns {node is VDom.VDocumentFragment}
   */
  isGroup(node) {
    return (
      node instanceof this.host.DocumentFragment &&
      !('__isShadowRootContainer' in node)
    );
  }

  /**
   * @param {any} child
   * @returns {child is VDom.VNode}
   */
  isNode(child) {
    return child instanceof this.host.Node;
  }

  /**
   * @param {(node: VDom.VNode) => Promise<any>} callback
   */
  scheduleTeleport(callback) {
    const anchorNode = this.host.document.createComment('teleport-anchor');
    this.host.document.teleportMounts.push(() => callback(anchorNode));
    const ref = Cell.source(anchorNode);
    Reflect.set(anchorNode, '__isTeleportAnchor', true);
    Reflect.set(anchorNode, '__ref', ref);
    return anchorNode;
  }
}

import { VText, VComment, VDocumentFragment } from './index.js';
const ShadowRootKey = Ops.SHADOW_ROOT_KEY;

/**
 * @param {string} tagname
 * @param {any} props
 */
function isDynamicContainer(tagname, props) {
  if (tagname === 'retend-unique-instance') return true;

  for (const key in props) {
    const value = props[key];
    if (key.startsWith('on') && key.length > 2) return true;
    if (key === 'ref' && Cell.isCell(value)) return true;
    if (Cell.isCell(value)) return true;

    if (key === 'children') {
      if (isReactiveChild(value)) return true;
    }
  }
  return false;
}

/** @param {any} value  */
function isReactiveChild(value) {
  if (Cell.isCell(value)) return true;
  if (Array.isArray(value)) {
    for (const c of value) if (isReactiveChild(c)) return true;
  }
  if (value instanceof VDocumentFragment) {
    // @ts-expect-error
    if (value[ShadowRootKey]) return true;
    for (const sc of value.childNodes) {
      if (isReactiveChild(sc)) return true;
    }
  }
  // @ts-expect-error
  if (value instanceof VText && value.__attributeCells?.size) return true;
  // @ts-expect-error
  if (value instanceof VComment && value.__commentRangeSymbol) return true;
  return false;
}
