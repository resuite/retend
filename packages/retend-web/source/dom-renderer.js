/** @import { Observer, ReconcilerOptions, Renderer, __HMR_UpdatableFn } from "retend"; */
/** @import { JSX } from 'retend/jsx-runtime'; */
/** @import { ConnectedComment, HiddenElementProperties } from './utils.js'; */

import { Cell, createNodesFromTemplate } from 'retend';
import { withHMRBoundaries } from './plugin/hmr.js';
import {
  addCellListener,
  containerIsDynamic,
  DeferredHandleSymbol,
  flattenJSXChildren,
  isReactiveChild,
  Skip,
} from './utils.js';
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
  staticStyleIds = new Set();

  #isHydrating = false;
  /** @type {Promise<void> | null} */
  #readyToHydrateChildren = null;
  /** @type {null | ((value: void) => void)} */
  #startHydratingChildren = null;
  /** @type {Array<() => Promise<*>>} */
  #scheduledHydrationTeleports = [];
  /**
   * @type {JsxElement[]}
   * A list of all the dynamic elements
   * that need to be hydrated.
   */
  #hydrationTable = [];
  #hydrationDynamicNodeCursor = 0;

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
    if (this.#isHydrating) {
      /** @type {DeferredHandleSymbol[]} */ // @ts-expect-error
      const array = fragment;
      const symbol = new DeferredHandleSymbol(array);
      array.splice(0, 0, symbol);
      array.push(symbol);
      // @ts-expect-error
      return array;
    }
    return Ops.createGroupHandle(fragment, this);
  }

  /**
   * @param {DOMHandle} segment
   * @param {Node[]} newContent
   */
  write(segment, newContent) {
    if (this.#isHydrating) {
      //@ts-expect-error
      segment.splice(1, segment.length - 2, ...newContent);
      return segment;
    }
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
    // Allow retend:collection even for Skip objects during hydration,
    // so the For cache can be updated when Skip is resolved to real DOM.
    if (
      this.#isHydrating &&
      node instanceof Skip &&
      key !== 'retend:collection'
    ) {
      return node;
    }
    return Ops.setProperty(node, key, value);
  }

  /**
   * @param {__HMR_UpdatableFn} tagname
   * @param {any} props
   * @param {JSX.JSXDevFileData} [fileData]
   */
  handleComponent(tagname, props, fileData) {
    // @ts-expect-error: Vite types are not ingrained
    if (import.meta.env?.DEV) {
      return withHMRBoundaries(tagname, props, fileData, this);
    }
    const template = tagname(...props);
    /** @type {Node[]} */
    const nodes = createNodesFromTemplate(template, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  /**
   * @param {Node} _parentNode
   * @param {Node | Node[]} childNode
   */
  append(_parentNode, childNode) {
    const parentNode = /** @type {Element} */ (_parentNode);
    if (this.#isHydrating) return parentNode;

    const shadowRoot = Ops.appendShadowRoot(parentNode, childNode, this);
    if (shadowRoot) return shadowRoot;

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
    if (this.#isHydrating) {
      if (input) {
        // @ts-expect-error
        if (Array.isArray(input)) return input;
        // @ts-expect-error
        return [input];
      }
      // @ts-expect-error
      return [];
    }
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
   * @returns {JsxElement}
   */
  createContainer(tagname, props) {
    if (this.#isHydrating) {
      if (containerIsDynamic(tagname, props, isReactiveChild)) {
        const index = this.#hydrationDynamicNodeCursor++;
        const staticNode = this.#hydrationTable[index];
        this.#hydrateNode(staticNode, props);
        return staticNode;
      }
      // @ts-expect-error: The types are different in hydration mode.
      return new Skip(tagname);
    }

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
    return element;
  }

  /**
   * @param {string | Cell<any>} text
   */
  createText(text) {
    if (this.#isHydrating) {
      if (Cell.isCell(text)) return text;
      return new Skip(text);
    }
    return Ops.createText(text, this);
  }

  /**
   * @param {Node} node
   * @returns {node is DocumentFragment}
   */
  isGroup(node) {
    return node instanceof this.host.DocumentFragment;
  }

  /**
   * @param {any} child
   * @returns {child is Node}
   */
  isNode(child) {
    return (
      (this.#isHydrating && child instanceof Skip) ||
      child instanceof this.host.Node ||
      child instanceof Ops.ShadowRootFragment
    );
  }

  /**
   * @param {(node?: Node) => Promise<*>} callback
   * @param {Observer} observer
   */
  scheduleTeleport(callback, observer) {
    if (this.#isHydrating) {
      this.#scheduledHydrationTeleports.push(callback);
      return new Skip('teleport');
    }
    const anchorNode = this.host.document.createComment('teleport-anchor');
    const ref = Cell.source(anchorNode);
    observer.onConnected(ref, callback);
    return anchorNode;
  }

  enableHydrationMode() {
    /** @type {JsxElement[]} */
    const dynamicNodeTable = [];
    /** @type {ParentNode[]} */
    const roots = [document];

    while (roots.length > 0) {
      const root = /** @type {ParentNode} */ (roots.pop());
      const dynamicNodes = root.querySelectorAll('[data-dyn]');
      for (const node of dynamicNodes) {
        // @ts-expect-error: no need for stringifying.
        dynamicNodeTable[node.getAttribute('data-dyn')] = node;
        if (node.shadowRoot) roots.push(node.shadowRoot);
      }
    }

    this.#isHydrating = true;
    this.#hydrationTable = dynamicNodeTable;
    this.#readyToHydrateChildren = new Promise((resolve) => {
      this.#startHydratingChildren = resolve;
    });
  }

  /**
   * @param {Promise<any>} promise
   * @returns {Promise<void>}
   */
  async hydrateChildrenWhenResolved(promise) {
    await promise;
    this.#startHydratingChildren?.();
  }

  /**
   * @param {any} props
   * @param {ParentNode} staticNode
   */
  async #hydrateNode(staticNode, props) {
    // staticNode.removeAttribute('data-dyn');
    for (const key in props) {
      if (key !== 'children') this.setProperty(staticNode, key, props[key]);
    }

    await this.#readyToHydrateChildren;
    const { updateText } = this;
    const { children } = props;

    const isShadowRoot =
      children instanceof Ops.ShadowRootFragment &&
      staticNode instanceof Element;

    if (isShadowRoot) {
      const root =
        staticNode.shadowRoot ?? staticNode.attachShadow({ mode: 'open' });
      this.#hydrateNode(root, children.props);
      return;
    }

    if (Cell.isCell(children) && staticNode.firstChild instanceof Text) {
      /**
       * @param {string} value
       * @this {Text}
       */
      function listener(value) {
        updateText(value, this);
      }
      addCellListener(staticNode.firstChild, children, listener, false);
      return;
    }
    if (!Array.isArray(children)) return;
    const resolvedChildren = flattenJSXChildren(children);
    let nodeIndex = 0;
    let domIndex = 0;

    while (true) {
      const node = resolvedChildren[nodeIndex];
      const domNode = staticNode.childNodes[domIndex];
      if (domNode instanceof Comment && domNode.textContent === '@@') {
        // Skip HTML separators added by the serializer.
        domNode.remove();
        continue;
      }

      const isShadowRoot =
        node instanceof Ops.ShadowRootFragment && staticNode instanceof Element;

      if (isShadowRoot) {
        const root =
          staticNode.shadowRoot ?? staticNode.attachShadow({ mode: 'open' });
        this.#hydrateNode(root, node.props);
        nodeIndex++;
        continue;
      }

      if (!node) break;
      const skip =
        node === domNode ||
        node instanceof Skip ||
        typeof node === 'string' ||
        typeof node === 'number';

      if (skip) {
        // When a Skip node is encountered during hydration, we need to update
        // any For cache that references it to use the actual DOM node instead.
        // This ensures reconcile can call node.remove() later.
        if (node instanceof Skip && domNode) {
          const collection = Reflect.get(node, '__retend_collection_ref');
          if (Array.isArray(collection)) {
            const idx = collection.indexOf(node);
            if (idx !== -1) {
              collection[idx] = domNode;
            }
          }
        }
        nodeIndex++;
        domIndex++;
        continue;
      }

      if (node instanceof DeferredHandleSymbol && domNode instanceof Comment) {
        Reflect.set(domNode, '__commentRangeSymbol', node.symbol);
        if (node.sourceArray[0] instanceof Comment) {
          // This is end comment marker.
          node.sourceArray.push(domNode);
        } else {
          // this is start comment marker
          node.sourceArray.length = 0;
          node.sourceArray.push(domNode);
        }
        nodeIndex++;
        domIndex++;
        continue;
      }

      if (Cell.isCell(node) && domNode instanceof Text) {
        /**
         * @param {string} value
         * @this {Text}
         */
        function listener(value) {
          updateText(value, this);
        }
        addCellListener(domNode, node, listener, false);
        nodeIndex++;
        domIndex++;
        continue;
      }

      console.error('Hydration error: Expected', node, 'but got', domNode);
      nodeIndex++;
      domIndex++;
    }
  }

  async endHydration() {
    for (const mount of this.#scheduledHydrationTeleports) {
      await mount();
    }
    this.#isHydrating = false;
    this.#hydrationTable = [];
    this.#readyToHydrateChildren = null;
    this.#startHydratingChildren = null;
    this.#scheduledHydrationTeleports = [];
  }
}
