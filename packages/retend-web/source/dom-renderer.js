/** @import { Observer, ReconcilerOptions, Renderer, __HMR_UpdatableFn, StateSnapshot } from "retend"; */
/** @import { JSX } from 'retend/jsx-runtime'; */
/** @import { ConnectedComment, HiddenElementProperties } from './utils.js'; */

import {
  getState,
  Cell,
  createNodesFromTemplate,
  normalizeJsxChild,
} from 'retend';
import * as Ops from './dom-ops.js';
import { withHMRBoundaries } from './plugin/hmr.js';
import {
  DeferredHandleSymbol,
  Skip,
  addCellListener,
  containerIsDynamic,
  flattenJSXChildren,
  isReactiveChild,
} from './utils.js';

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
  /** @type {Window} */
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
  /** @type {Map<StateSnapshot, number>} */
  #branches = new Map();
  /** @type {StateSnapshot} */ // @ts-expect-error: see vdomrenderer.
  #currentBranch;
  /** @type {Map<string, JsxElement>} */
  #table = new Map();

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
    this.#currentBranch = getState();
    return normalizeJsxChild(app, this);
  }

  /**
   * @param {Node} node
   */
  isActive(node) {
    return node.isConnected;
  }

  /** @param {() => void} processor  */
  onViewChange(processor) {
    const mutObserver = new MutationObserver(processor);
    mutObserver.observe(window.document.body, {
      subtree: true,
      childList: true,
    });
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
   * @param {StateSnapshot} [snapshot]
   * @param {JSX.JSXDevFileData} [fileData]
   */
  handleComponent(tagname, props, snapshot, fileData) {
    const renderComponent = () => {
      // @ts-expect-error: Vite types are not ingrained
      if (import.meta.env?.DEV) {
        return withHMRBoundaries(tagname, props, fileData, this);
      }
      const template = tagname(...props);
      /** @type {Node[]} */
      const nodes = createNodesFromTemplate(template, this);
      return nodes.length === 1 ? nodes[0] : nodes;
    };

    if (!this.#isHydrating) {
      return renderComponent();
    }

    if (snapshot === undefined) {
      return renderComponent();
    }

    const previousBranch = this.#currentBranch;
    this.#currentBranch = snapshot;
    this.#branches.set(snapshot, this.#branches.get(snapshot) || 0);
    try {
      return renderComponent();
    } finally {
      this.#currentBranch = previousBranch;
    }
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
      childNode instanceof HTMLElement
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
        const branchCursor = this.#branches.get(this.#currentBranch) || 0;
        const index = `${this.#currentBranch.node.id}.${branchCursor}`;
        this.#branches.set(this.#currentBranch, branchCursor + 1);

        const staticNode = this.#table.get(index);
        if (staticNode) {
          this.#hydrateNode(staticNode, props);
          return staticNode;
        }
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
    return node instanceof DocumentFragment;
  }

  /**
   * @param {any} child
   * @returns {child is Node}
   */
  isNode(child) {
    return (
      (this.#isHydrating && child instanceof Skip) ||
      child instanceof Node ||
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
    /** @type {Map<string, JsxElement>} */
    const dynamicNodeTable = new Map();
    /** @type {ParentNode[]} */
    const roots = [document];

    while (roots.length > 0) {
      const root = /** @type {ParentNode} */ (roots.pop());
      const dynamicNodes = /** @type {NodeListOf<JsxElement>} */ (
        root.querySelectorAll('[data-dyn]')
      );
      for (const node of dynamicNodes) {
        dynamicNodeTable.set(String(node.getAttribute('data-dyn')), node);
        if (node.shadowRoot) roots.push(node.shadowRoot);
      }
    }

    this.#isHydrating = true;
    this.#table = dynamicNodeTable;
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

    if (Cell.isCell(children)) {
      const textNode = staticNode.firstChild;
      if (!(textNode instanceof Text)) {
        console.error('Hydration error: Expected text node but got', textNode);
        return;
      }
      const expectedValue = children.get();
      if (!(expectedValue instanceof Promise)) {
        const expectedText = String(expectedValue);
        if (textNode.textContent !== expectedText) {
          console.error(
            'Hydration error: Expected text',
            expectedText,
            'but got',
            textNode.textContent
          );
        }
      }
      /**
       * @param {any} value
       * @this {Text}
       */
      function listener(value) {
        if (value instanceof Promise) {
          value.then((resolvedValue) => {
            updateText(resolvedValue, this);
          });
        } else updateText(value, this);
      }
      addCellListener(textNode, children, listener, false);
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
        const expectedValue = node.get();
        if (!(expectedValue instanceof Promise)) {
          const expectedText = String(expectedValue);
          if (domNode.textContent !== expectedText) {
            console.error(
              'Hydration error: Expected text',
              expectedText,
              'but got',
              domNode.textContent
            );
          }
        }
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
    this.#table = new Map();
    this.#readyToHydrateChildren = null;
    this.#startHydratingChildren = null;
    this.#scheduledHydrationTeleports = [];
  }
}
