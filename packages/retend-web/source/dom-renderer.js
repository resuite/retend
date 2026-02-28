/** @import { Observer, ReconcilerOptions, Renderer, __HMR_UpdatableFn, StateSnapshot } from "retend"; */
/** @import { JSX } from 'retend/jsx-runtime'; */
/** @import { ConnectedComment, HiddenElementProperties } from './utils.js'; */

import {
  Await,
  Cell,
  branchState,
  createNodesFromTemplate,
  getState,
  normalizeJsxChild,
  withState,
  onConnected,
  setActiveRenderer,
  runPendingSetupEffects,
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
import { getGlobalContext, setGlobalContext } from 'retend/context';

const COMMENT_NODE = 8;
const TEXT_NODE = 3;
const DOCUMENT_FRAGMENT_NODE = 11;

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
  /** @type {Observer | null} */
  observer = null;
  staticStyleIds = new Set();

  #isHydrationModeEnabled = false;

  /** @type {Array<{ callback: () => Promise<*> }>} */
  #scheduledHydrationTeleports = [];
  /** @type {Set<Promise<void>>} */
  #pendingHydrationTasks = new Set();
  /** @type {Set<any[]>} */
  #deferredHydrationHandles = new Set();

  #hydratingBranchCount = 0;
  /** @type {Map<string, JsxElement>} */
  #table = new Map();
  #hydratedNodes = new WeakSet();

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
    if (this.#isHydrationModeEnabled && this.#getHydrationState()) {
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
    if (this.#isHydrationModeEnabled && this.#getHydrationState()) {
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
    // On first reconcile pass, a range may already contain untracked nodes
    // (e.g. server-rendered content before first async client resolve).
    // Clear them once so reconcile does not duplicate content.
    const cacheFromLastRun = options.cacheFromLastRun;
    if (cacheFromLastRun && cacheFromLastRun.size === 0) {
      const start = segment[0];
      const end = segment[1];
      let cursor = start?.nextSibling;
      while (cursor && cursor !== end) {
        const next = cursor.nextSibling;
        cursor.remove();
        cursor = next;
      }
    }
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
    if (!this.#isHydrationModeEnabled) {
      return Ops.setProperty(node, key, value);
    }
    // Allow retend:collection even for Skip objects during hydration,
    // so the For cache can be updated when Skip is resolved to real DOM.
    if (
      this.#getHydrationState() &&
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
   * @param {StateSnapshot} [_]
   * @param {JSX.JSXDevFileData} [fileData]
   * @returns {Node | Node[]}
   */
  handleComponent(tagname, props, _, fileData) {
    if (!this.#isHydrationModeEnabled) {
      // @ts-expect-error: Vite types are not ingrained
      if (import.meta.env?.DEV) {
        return withHMRBoundaries(tagname, props, fileData, this);
      }
      const template = tagname(...props);
      /** @type {Node[]} */
      const nodes = createNodesFromTemplate(template, this);
      return nodes.length === 1 ? nodes[0] : nodes;
    }

    const branch = getState();
    this.#enterHydrationBranch(branch);
    try {
      if (tagname === Await) {
        return withState(branchState(), () => {
          const nodes = createNodesFromTemplate(props[0]?.children, this);
          const group = this.createGroup(nodes);
          this.createGroupHandle(group);
          return group;
        });
      }
      // @ts-expect-error: Vite types are not ingrained
      if (import.meta.env?.DEV) {
        return withHMRBoundaries(tagname, props, fileData, this);
      }
      const template = tagname(...props);
      /** @type {Node[]} */
      const nodes = createNodesFromTemplate(template, this);
      return nodes.length === 1 ? nodes[0] : nodes;
    } finally {
      this.#leaveHydrationBranch(branch);
    }
  }

  /**
   * @param {Node} _parentNode
   * @param {Node | Node[]} childNode
   */
  append(_parentNode, childNode) {
    const parentNode = /** @type {Element} */ (_parentNode);
    if (this.#isHydrationModeEnabled && this.#getHydrationState()) {
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
    if (this.#isHydrationModeEnabled && this.#getHydrationState()) {
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
    if (this.#isHydrationModeEnabled) {
      const hydration = this.#getHydrationState();
      if (hydration) {
        if (containerIsDynamic(tagname, props, isReactiveChild)) {
          const branchCursor = hydration.cursor;
          const activeBranch = getState();
          const index = `${activeBranch.node.id}.${branchCursor}`;
          hydration.cursor += 1;

          const staticNode = this.#table.get(index);
          const hydrationNode =
            staticNode && !this.#hydratedNodes.has(staticNode)
              ? staticNode
              : null;
          if (hydrationNode) {
            this.#hydratedNodes.add(hydrationNode);
            const hydrationTask = this.#hydrateNode(hydrationNode, props);
            this.#trackHydrationTask(activeBranch, hydrationTask);
            return hydrationNode;
          }
        }
        // @ts-expect-error: The types are different in hydration mode.
        return new Skip(tagname);
      }
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
    if (this.#isHydrationModeEnabled && this.#getHydrationState()) {
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
    return node?.nodeType === DOCUMENT_FRAGMENT_NODE;
  }

  /**
   * @param {any} child
   * @returns {child is Node}
   */
  isNode(child) {
    if (child instanceof Node || child instanceof Ops.ShadowRootFragment) {
      return true;
    }
    if (!(child instanceof Skip) || !this.#isHydrationModeEnabled) {
      return false;
    }
    return this.#getHydrationState() !== null;
  }

  /**
   * @param {(node?: Node) => Promise<*>} callback
   */
  scheduleTeleport(callback) {
    if (this.#isHydrationModeEnabled && this.#getHydrationState()) {
      const branch = getState();
      const capturedScopes = branch.scopes;
      let resolveTask = () => {};
      /** @type {Promise<void>} */
      const pendingTask = new Promise((resolve) => {
        resolveTask = () => resolve();
      });
      this.#trackHydrationTask(branch, pendingTask);
      this.#scheduledHydrationTeleports.push({
        callback: async () => {
          const previousScopes = branch.scopes;
          branch.scopes = capturedScopes;
          this.#enterHydrationBranch(branch);
          try {
            return await callback();
          } finally {
            this.#leaveHydrationBranch(branch);
            branch.scopes = previousScopes;
            resolveTask();
          }
        },
      });
      return new Skip('teleport');
    }
    const anchorNode = this.host.document.createComment('teleport-anchor');
    const ref = Cell.source(anchorNode);
    onConnected(ref, callback);
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
    this.#pendingHydrationTasks.clear();
    this.#hydratingBranchCount = 0;
    this.#hydratedNodes = new WeakSet();
    this.#table = dynamicNodeTable;
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

    const { updateText } = this;
    const { children } = props;
    const staticIsElement = staticNode instanceof Element;

    const isShadowRoot =
      children instanceof Ops.ShadowRootFragment && staticIsElement;

    if (isShadowRoot) {
      const root =
        staticNode.shadowRoot ?? staticNode.attachShadow({ mode: 'open' });
      this.#hydrateNode(root, children.props);
      return;
    }

    if (Cell.isCell(children)) {
      const textNode = staticNode.firstChild;
      if (!textNode || textNode.nodeType !== TEXT_NODE) {
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
      addCellListener(
        /** @type {Text} */ (textNode),
        children,
        listener,
        false
      );
      if (expectedValue instanceof Promise) {
        Promise.resolve(children.get()).then((resolvedValue) => {
          updateText(resolvedValue, textNode);
        });
      }
      return;
    }
    if (!Array.isArray(children)) return;
    const resolvedChildren = flattenJSXChildren(children);
    const domChildren = staticNode.childNodes;
    let nodeIndex = 0;
    let domIndex = 0;

    while (true) {
      const node = resolvedChildren[nodeIndex];
      const domNode = domChildren[domIndex];
      if (domNode?.nodeType === COMMENT_NODE && domNode.textContent === '@@') {
        // Skip HTML separators added by the serializer.
        domNode.remove();
        continue;
      }

      const isShadowRoot =
        node instanceof Ops.ShadowRootFragment && staticIsElement;

      if (isShadowRoot) {
        const root =
          staticNode.shadowRoot ?? staticNode.attachShadow({ mode: 'open' });
        this.#hydrateNode(root, node.props);
        nodeIndex++;
        continue;
      }

      if (!node) break;
      const nodeType = typeof node;
      const skip =
        node === domNode ||
        node instanceof Skip ||
        nodeType === 'string' ||
        nodeType === 'number';

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

      if (
        node instanceof DeferredHandleSymbol &&
        domNode?.nodeType === COMMENT_NODE
      ) {
        const nextNode = resolvedChildren[nodeIndex + 1];
        const isEmptyLiveRange =
          nextNode instanceof DeferredHandleSymbol && nextNode === node;

        // If live range is unresolved (only `[` and `]`) but server DOM still
        // contains content inside the serialized range, skip that static range
        // while hydrating the parent and bind both boundary comments now.
        if (isEmptyLiveRange && domNode.textContent === '[') {
          const range = this.#findSerializedRangeCloseComment(
            /** @type {Comment} */ (domNode)
          );
          if (range) {
            const { close: closingComment, offset } = range;
            Reflect.set(domNode, '__commentRangeSymbol', node.symbol);
            Reflect.set(closingComment, '__commentRangeSymbol', node.symbol);
            node.sourceArray.length = 0;
            node.sourceArray.push(domNode, closingComment);
            nodeIndex += 2;
            domIndex += offset + 1;
            continue;
          }
        }

        Reflect.set(domNode, '__commentRangeSymbol', node.symbol);
        if (node.sourceArray[0]?.nodeType === COMMENT_NODE) {
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
        const domNodeIsText = domNode?.nodeType === TEXT_NODE;
        if (domNodeIsText) {
          textNode = /** @type {Text} */ (domNode);
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
            if (domNodeIsText) {
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
         * @param {any} value
         * @this {Text}
         */
        function listener(value) {
          if (value instanceof Promise) {
            value.then((resolvedValue) => updateText(resolvedValue, this));
          } else {
            updateText(value, this);
          }
        }
        addCellListener(textNode, node, listener, false);
        if (expectedValue instanceof Promise) {
          Promise.resolve(node.get()).then((resolvedValue) => {
            updateText(resolvedValue, textNode);
          });
        }
        nodeIndex++;
        continue;
      }

      console.error('Hydration error: Expected', node, 'but got', domNode);
      nodeIndex++;
      domIndex++;
    }
  }

  /**
   * @param {Comment} startComment
   * @returns {{ close: Comment, offset: number } | null}
   */
  #findSerializedRangeCloseComment(startComment) {
    if (startComment.textContent !== '[') return null;
    let depth = 1;
    let cursor = startComment.nextSibling;
    let offset = 1;
    while (cursor) {
      if (cursor.nodeType === COMMENT_NODE) {
        if (cursor.textContent === '[') depth += 1;
        else if (cursor.textContent === ']') {
          depth -= 1;
          if (depth === 0)
            return { close: /** @type {Comment} */ (cursor), offset };
        }
      }
      cursor = cursor.nextSibling;
      offset += 1;
    }
    return null;
  }

  async endHydration() {
    for (const mount of this.#scheduledHydrationTeleports) {
      await mount.callback();
      this.#flushObserverMountedNodes();
    }
    await Promise.all(this.#pendingHydrationTasks);
    this.#flushObserverMountedNodes();
    for (const handle of this.#deferredHydrationHandles) {
      Ops.finalizeHydrationHandleSegment(handle);
    }
    this.#isHydrationModeEnabled = false;
    this.#table = new Map();
    this.#hydratedNodes = new WeakSet();
    this.#hydratingBranchCount = 0;
    this.#scheduledHydrationTeleports = [];
    this.#pendingHydrationTasks.clear();
    this.#deferredHydrationHandles.clear();
    this.#flushObserverMountedNodes();
  }

  /**
   * @param {StateSnapshot} branch
   */
  #ensureHydrationBranch(branch) {
    if (branch.data) return branch.data;
    const state = {
      cursor: 0,
      renderDepth: 0,
      pendingHydrations: 0,
      hydrating: true,
    };
    branch.data = state;
    this.#hydratingBranchCount += 1;
    return state;
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
    const state = branch.data;
    if (!state) return;
    state.renderDepth = Math.max(0, state.renderDepth - 1);
    if (state.renderDepth === 0) {
      this.#flushObserverMountedNodes();
    }
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
      const activeState = branch.data;
      if (!activeState) return;
      activeState.pendingHydrations = Math.max(
        0,
        activeState.pendingHydrations - 1
      );
      this.#maybeCompleteHydrationBranch(activeState);
      this.#flushObserverMountedNodes();
    });
  }

  #flushObserverMountedNodes() {
    this.observer?.processMountedNodes();
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

  /**
   * Returns the hydration state for the current branch, or null if not hydrating.
   */
  #getHydrationState() {
    if (!this.#isHydrationModeEnabled) return null;
    const hydration = getState().data;
    if (!hydration) {
      return this.#hydratingBranchCount > 0
        ? { cursor: 0, renderDepth: 0, pendingHydrations: 0, hydrating: true }
        : null;
    }
    return hydration.hydrating ? hydration : null;
  }
}

/**
 * Renders the provided JSX application to the specified DOM element.
 *
 * Initializes the DOM renderer context, renders the application tree, appends the resulting
 * nodes to the target element, and executes any pending setup effects.
 *
 * @param {HTMLElement} element - The target DOM element to mount the application into.
 * @param {() => JSX.Template} App - A function that returns the template to be rendered.
 */
export function renderToDOM(element, App) {
  setGlobalContext(
    getGlobalContext() ?? {
      teleportIdCounter: { value: 0 },
      globalData: new Map(),
    }
  );
  const renderer = new DOMRenderer(window);
  setActiveRenderer(renderer);
  const root = renderer.render(App);
  element.append(...(Array.isArray(root) ? root : [root]));
  runPendingSetupEffects();
}
