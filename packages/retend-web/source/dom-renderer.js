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

  #isHydrationModeEnabled = false;

  /** @type {Promise<void> | null} */
  #readyToHydrateChildren = null;
  /** @type {null | ((value: void) => void)} */
  #startHydratingChildren = null;
  /** @type {Array<{ callback: () => Promise<*> }>} */
  #scheduledHydrationTeleports = [];
  /** @type {Set<Promise<void>>} */
  #pendingHydrationTasks = new Set();
  /** @type {Set<any[]>} */
  #deferredHydrationHandles = new Set();
  /** @type {Map<StateSnapshot, { cursor: number, renderDepth: number, pendingHydrations: number, hydrating: boolean }>} */
  #hydrationBranches = new Map();
  #hydratingBranchCount = 0;
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
    const rootBranch = getState();
    this.#currentBranch = rootBranch;
    if (!this.#isHydrationModeEnabled) {
      return normalizeJsxChild(app, this);
    }

    this.#enterHydrationBranch(rootBranch);
    try {
      return normalizeJsxChild(app, this);
    } finally {
      this.#leaveHydrationBranch(rootBranch);
    }
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
    if (this.#isCurrentBranchHydrating()) {
      /** @type {DeferredHandleSymbol[]} */ // @ts-expect-error
      const array = fragment;
      const symbol = new DeferredHandleSymbol([]);
      array.splice(0, 0, symbol);
      array.push(symbol);
      this.#deferredHydrationHandles.add(array);
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
    if (this.#isCurrentBranchHydrating()) {
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
      this.#isCurrentBranchHydrating() &&
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

    if (!this.#isHydrationModeEnabled) {
      return renderComponent();
    }

    const branch = snapshot ?? this.#currentBranch;
    if (!branch) return renderComponent();
    const previousBranch = this.#currentBranch;
    this.#currentBranch = branch;
    this.#enterHydrationBranch(branch);
    try {
      return renderComponent();
    } finally {
      this.#leaveHydrationBranch(branch);
      this.#currentBranch = previousBranch;
    }
  }

  /**
   * @param {Node} _parentNode
   * @param {Node | Node[]} childNode
   */
  append(_parentNode, childNode) {
    const parentNode = /** @type {Element} */ (_parentNode);
    if (this.#isCurrentBranchHydrating()) {
      // During hydration, groups are represented as plain arrays.
      // We must still collect children into them so that
      // normalizeJsxChild can build up fragment content.
      if (Array.isArray(_parentNode)) {
        if (Array.isArray(childNode)) {
          _parentNode.push(...childNode);
        } else if (childNode) {
          _parentNode.push(childNode);
        }
      }
      return parentNode;
    }

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
    if (this.#isCurrentBranchHydrating()) {
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
    if (this.#isCurrentBranchHydrating()) {
      if (containerIsDynamic(tagname, props, isReactiveChild)) {
        const activeBranch = this.#currentBranch;
        const branchState =
          activeBranch && this.#ensureHydrationBranch(activeBranch);
        const branchCursor = branchState?.cursor ?? 0;
        const index = `${this.#currentBranch.node.id}.${branchCursor}`;
        if (branchState) branchState.cursor += 1;

        const staticNode = this.#table.get(index);
        if (staticNode) {
          const hydrationTask = this.#hydrateNode(staticNode, props);
          if (activeBranch) {
            this.#trackHydrationTask(activeBranch, hydrationTask);
          }
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
    if (this.#isCurrentBranchHydrating()) {
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
      (this.#isCurrentBranchHydrating() && child instanceof Skip) ||
      child instanceof Node ||
      child instanceof Ops.ShadowRootFragment
    );
  }

  /**
   * @param {(node?: Node) => Promise<*>} callback
   * @param {Observer} observer
   */
  scheduleTeleport(callback, observer) {
    if (this.#isCurrentBranchHydrating()) {
      const branch = this.#currentBranch;
      if (branch) {
        let resolveTask = () => {};
        const pendingTask = new Promise((resolve) => {
          resolveTask = () => resolve(undefined);
        });
        this.#trackHydrationTask(branch, pendingTask);
        this.#scheduledHydrationTeleports.push({
          callback: async () => {
            const previousBranch = this.#currentBranch;
            this.#currentBranch = branch;
            this.#enterHydrationBranch(branch);
            try {
              return await callback();
            } finally {
              this.#leaveHydrationBranch(branch);
              this.#currentBranch = previousBranch;
              resolveTask();
            }
          },
        });
      } else {
        this.#scheduledHydrationTeleports.push({ callback });
      }
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

    this.#isHydrationModeEnabled = true;
    this.#hydrationBranches.clear();
    this.#pendingHydrationTasks.clear();
    this.#hydratingBranchCount = 0;
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

      if (Cell.isCell(node)) {
        /** @type {Text} */
        let textNode;
        if (domNode instanceof Text) {
          textNode = domNode;
          domIndex++;
        } else {
          // The Cell's value was empty during SSR, so no text node was
          // created by the browser. Create one now and insert it.
          textNode = this.host.document.createTextNode('');
          if (domNode) {
            staticNode.insertBefore(textNode, domNode);
          } else {
            staticNode.appendChild(textNode);
          }
        }
        const expectedValue = node.get();
        if (!(expectedValue instanceof Promise)) {
          const expectedText = String(expectedValue);
          if (textNode.textContent !== expectedText) {
            if (domNode instanceof Text) {
              console.error(
                'Hydration error: Expected text',
                expectedText,
                'but got',
                textNode.textContent
              );
            }
            textNode.textContent = expectedText;
          }
        }
        /**
         * @param {string} value
         * @this {Text}
         */
        function listener(value) {
          updateText(value, this);
        }
        addCellListener(textNode, node, listener, false);
        nodeIndex++;
        continue;
      }

      console.error('Hydration error: Expected', node, 'but got', domNode);
      nodeIndex++;
      domIndex++;
    }
  }

  async endHydration() {
    for (const mount of this.#scheduledHydrationTeleports) {
      await mount.callback();
    }
    await Promise.all([...this.#pendingHydrationTasks]);
    for (const handle of this.#deferredHydrationHandles) {
      Ops.finalizeHydrationHandleSegment(handle);
    }
    this.#isHydrationModeEnabled = false;
    this.#table = new Map();
    this.#hydrationBranches = new Map();
    this.#hydratingBranchCount = 0;
    this.#readyToHydrateChildren = null;
    this.#startHydratingChildren = null;
    this.#scheduledHydrationTeleports = [];
    this.#pendingHydrationTasks.clear();
    this.#deferredHydrationHandles.clear();
  }

  /**
   * @param {StateSnapshot} branch
   */
  #ensureHydrationBranch(branch) {
    const existing = this.#hydrationBranches.get(branch);
    if (existing) return existing;
    const next = {
      cursor: 0,
      renderDepth: 0,
      pendingHydrations: 0,
      hydrating: true,
    };
    this.#hydrationBranches.set(branch, next);
    this.#hydratingBranchCount += 1;
    return next;
  }

  /**
   * @param {StateSnapshot} branch
   */
  #enterHydrationBranch(branch) {
    if (!this.#isHydrationModeEnabled) return;
    const state = this.#ensureHydrationBranch(branch);
    state.renderDepth += 1;
  }

  /**
   * @param {StateSnapshot} branch
   */
  #leaveHydrationBranch(branch) {
    if (!this.#isHydrationModeEnabled) return;
    const state = this.#hydrationBranches.get(branch);
    if (!state) return;
    state.renderDepth = Math.max(0, state.renderDepth - 1);
    this.#maybeCompleteHydrationBranch(state);
  }

  /**
   * @param {StateSnapshot} branch
   * @param {Promise<void>} task
   */
  #trackHydrationTask(branch, task) {
    if (!this.#isHydrationModeEnabled) return;
    const state = this.#ensureHydrationBranch(branch);
    state.pendingHydrations += 1;
    this.#pendingHydrationTasks.add(task);
    task.finally(() => {
      this.#pendingHydrationTasks.delete(task);
      const activeState = this.#hydrationBranches.get(branch);
      if (!activeState) return;
      activeState.pendingHydrations = Math.max(
        0,
        activeState.pendingHydrations - 1
      );
      this.#maybeCompleteHydrationBranch(activeState);
    });
  }

  /**
   * @param {{ cursor: number, renderDepth: number, pendingHydrations: number, hydrating: boolean }} state
   */
  #maybeCompleteHydrationBranch(state) {
    if (!state.hydrating) return;
    const branchIsIdle =
      state.renderDepth === 0 && state.pendingHydrations === 0;
    if (!branchIsIdle) return;
    state.hydrating = false;
    this.#hydratingBranchCount = Math.max(0, this.#hydratingBranchCount - 1);
  }

  #isCurrentBranchHydrating() {
    if (!this.#isHydrationModeEnabled) return false;
    const branch = this.#currentBranch;
    if (!branch) return this.#hydratingBranchCount > 0;
    const state = this.#hydrationBranches.get(branch);
    if (!state) return true;
    return state.hydrating;
  }
}
