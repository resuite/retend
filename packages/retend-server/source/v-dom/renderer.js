/** @import { Renderer, ReconcilerOptions, __HMR_UpdatableFn, StateSnapshot } from "retend"; */
/** @import * as VDom from './index.js' */
/** @import { JSX } from 'retend/jsx-runtime'; */

import {
  Cell,
  createNodesFromTemplate,
  normalizeJsxChild,
  getState,
} from 'retend';
import * as Ops from 'retend-web/dom-ops';
import { VComment, VDocumentFragment, VNode, VText } from './index.js';

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

  /**
   * Map of encountered control flow branches during rendering,
   * to the number of nodes generated within them.
   * @type {Map<StateSnapshot, number>}
   */
  #branches = new Map();
  /**
   * Current control flow branch being rendered.
   * @type {StateSnapshot}
   */
  #currentBranch;

  /** @param {VDom.VWindow} host */
  constructor(host, { markDynamicNodes } = { markDynamicNodes: false }) {
    this.host = host;
    this.markDynamicNodes = markDynamicNodes;
    this.#currentBranch = getState();
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

  onViewChange() {}

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
   * @param {StateSnapshot} [snapshot]
   */
  handleComponent(tagname, props, snapshot) {
    if (snapshot && this.markDynamicNodes) {
      const previousBranch = this.#currentBranch;
      this.#branches.set(snapshot, this.#branches.get(snapshot) || 0);
      this.#currentBranch = snapshot;
      try {
        const component = tagname(...props);
        /** @type {VDom.VNode[]} */
        const nodes = createNodesFromTemplate(component, this);
        return nodes.length === 1 ? nodes[0] : nodes;
      } finally {
        this.#currentBranch = previousBranch;
      }
    }

    // Repeated for performance.
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
    if (
      this.markDynamicNodes &&
      Ops.containerIsDynamic(tagname, props, isReactiveChild)
    ) {
      const index = this.#branches.get(this.#currentBranch) || 0;
      const id = `${this.#currentBranch.node.id}.${index}`;
      element.setAttribute('data-dyn', id);
      this.#branches.set(this.#currentBranch, index + 1);
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
   * @param {(node: VDom.VNode) => Promise<any>} callback
   */
  scheduleTeleport(callback) {
    const anchorNode = this.host.document.createComment('teleport-anchor');
    this.host.document.teleportMounts.push(() => callback(anchorNode));
    anchorNode.__isTeleportAnchor = true;
    return anchorNode;
  }
}

/** @param {any} value  */
function isReactiveChild(value) {
  if (Cell.isCell(value)) return true;
  if (Array.isArray(value)) {
    for (const c of value) if (isReactiveChild(c)) return true;
  }
  if (value instanceof VDocumentFragment) {
    for (const sc of value.childNodes) {
      if (isReactiveChild(sc)) return true;
    }
  }
  if (value instanceof Ops.ShadowRootFragment) return true;
  // @ts-expect-error
  if (value instanceof VText && value.__attributeCells?.size) return true;
  // @ts-expect-error
  if (value instanceof VComment && value.__commentRangeSymbol) return true;
  return false;
}
