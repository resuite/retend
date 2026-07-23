/** @import { Renderer, ReconcilerOptions, __HMR_UpdatableFn, StateSnapshot } from "retend"; */
/** @import * as VDom from './index.js' */
/** @import { JSX } from 'retend/jsx-runtime'; */

import {
  createNodesFromTemplate,
  normalizeJsxChild,
  getState,
  withState,
} from 'retend';
import * as Ops from 'retend-web/dom-ops';

import { VDocumentFragment, VNode } from './index.js';

/**
 * @typedef {VDom.VElement & { __attributeCells: any,__eventListenerList?: Map<any, any> }} JsxElement
 * @typedef {[VDom.VComment, VDom.VComment]} DOMHandle
 * @typedef {Renderer<VDOMRenderingTypes>} VDOMRendererInterface
 */

/**
 * @typedef VDOMRenderingTypes
 * @property {VDom.VNode} Node
 * @property {VDom.VNode} Text
 * @property {DOMHandle} Handle
 * @property {VDom.VDocumentFragment} Group
 * @property {JsxElement} Container
 * @property {VDom.VWindow} Host
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

  #savedHandles = new Map();
  #savedHandleId = 0;
  /** @param {VDom.VWindow} host */
  constructor(host) {
    this.host = host;
    // @ts-expect-error: all static styles need is staticStyleIds set and a window
    Ops.writeStaticStyles(this);
    this.capabilities = {
      supportsSetupEffects: false,
      supportsObserverConnectedCallbacks: false,
    };
  }

  /**
   * Renders the given application into a virtual DOM tree.
   *
   * @param {JSX.Template} app - The application to render.
   * @returns {VDom.VNode | VDom.VNode[]} The rendered virtual DOM tree.
   */
  render(app) {
    return normalizeJsxChild(app, this);
  }

  isActive() {
    return false;
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
    if (key.startsWith('on') && key.length > 2) return node;
    return Ops.setProperty(node, key, value);
  }

  /**
   * @param {__HMR_UpdatableFn} tagname
   * @param {any[]} props
   * @param {StateSnapshot} [_snapshot]
   */
  handleComponent(tagname, props, _snapshot) {
    /** @type {VDom.VNode[]} */
    const nodes = createNodesFromTemplate(tagname(...props), this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  /**
   * @param {VDom.VNode} parentNode
   * @param {VDom.VNode | VDom.VNode[]} childNode
   */
  append(parentNode, childNode) {
    const shadowRoot = Ops.appendShadowRoot(parentNode, childNode, this);
    if (shadowRoot) return shadowRoot;

    parentNode.append(...[childNode].flat().filter(Boolean));

    return parentNode;
  }

  /**
   * @param {string} text
   * @param {VDom.VNode} node
   */
  updateText(text, node) {
    return Ops.updateText(text, node);
  }

  /**
   * @returns {VDom.VDocumentFragment}
   */
  createGroup() {
    return this.host.document.createDocumentFragment();
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
   * @param {any} [_props]
   */
  createContainer(tagname, _props) {
    /** @type {JsxElement} */ // @ts-expect-error
    const element = this.host.document.createElement(tagname);
    return element;
  }

  /**
   * @param {string} text
   * @param {boolean} [_isReactive]
   */
  createText(text, _isReactive) {
    return this.host.document.createTextNode(String(text));
  }

  /**
   * @param {VNode} node
   * @returns {node is VDocumentFragment}
   */
  isGroup(node) {
    return node instanceof VDocumentFragment;
  }

  /**
   * @param {any} child
   * @returns {child is VDom.VNode}
   */
  isNode(child) {
    return child instanceof VNode || child instanceof Ops.ShadowRootFragment;
  }

  /**
   * @param {(node: VDom.VNode, canDefer?: boolean) => Promise<any>} callback
   * @param {string} [id]
   */
  scheduleTeleport(callback, id) {
    const anchorNode = this.host.document.createComment(
      id ? `retend:teleport:${id}` : 'retend:teleport'
    );
    const snapshot = { ...getState() };
    this.host.document.teleportMounts.push(() =>
      withState(snapshot, () => callback(anchorNode, true))
    );
    return anchorNode;
  }
}
