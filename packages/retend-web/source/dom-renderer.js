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
  waitForAsyncBoundaries,
} from 'retend';

import * as Ops from './dom-ops.js';
import { withHMRBoundaries } from './plugins/hmr.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const DOCUMENT_FRAGMENT_NODE = 11;
/** @type {Scope<string>} */
const NamespaceScope = createScope('retend-web:Namespace');
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MATH_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
const TELEPORT_ANCHOR_PREFIX = 'retend:teleport:';
const HYDRATION_CLAIM = Symbol();
const HYDRATION_RANGE_END = Symbol();
const HYDRATION_FRAGMENT_CHILDREN = Symbol();
const HYDRATION_HANDLE_STATE = Symbol();

class HydrationMismatchError extends Error {}

/**
 * @typedef {Element & HiddenElementProperties} JsxElement
 * @typedef {[ConnectedComment, ConnectedComment]} DOMHandle
 * @typedef {Renderer<DOMRenderingTypes>} DOMRendererInterface
 * @typedef {{ parent: ParentNode, nextChild: ChildNode | null, end?: Comment, start?: Comment, parentFrame?: HydrationFrame, claimed?: boolean }} HydrationFrame
 * @typedef {HydrationFrame & { start: Comment, end: Comment, parentFrame: HydrationFrame }} HydrationRange
 * @typedef {{ parent?: ParentNode, before?: ChildNode | null, opaque?: boolean }} HydrationClaim
 * @typedef {{ fragment?: DocumentFragment, frame?: HydrationFrame, phase?: 'initial' | 'rendered' | 'ignore-write', client?: boolean }} HydrationHandleState
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
  #hydrating = false;
  /** @type {ParentNode[]} */
  #hydrationRoots = [];
  /** @type {HydrationFrame[]} */
  #hydrationStack = [];
  /** @type {Array<() => Promise<unknown> | unknown>} */
  #pendingHydrationTeleports = [];
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
    const result = normalizeJsxChild(app, this);
    if (this.#hydrating) queueMicrotask(() => this.observer?.flush());
    return result;
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
    if (!this.#hydrating) {
      const handle = Ops.createGroupHandle(fragment, this);
      if (this.#hydrationStack.length) {
        Reflect.set(handle, HYDRATION_HANDLE_STATE, { client: true });
      }
      return handle;
    }

    const frame = this.#currentHydrationFrame();
    const range =
      frame &&
      (frame.start && !frame.claimed
        ? /** @type {HydrationRange} */ (frame)
        : this.#enterImmediateRange(frame));
    if (!range) throw new HydrationMismatchError('Expected a dynamic range.');
    range.claimed = true;
    for (const child of this.#getFragmentChildren(fragment)) {
      if (!this.#isClaimed(child)) {
        throw new HydrationMismatchError('Unexpected dynamic range content.');
      }
    }

    Reflect.set(range.end, HYDRATION_CLAIM, {
      parent: range.parentFrame.parent,
      before: range.end.nextSibling,
    });
    range.parentFrame.nextChild = range.end.nextSibling;
    this.#removeFrameAndDescendants(range);

    const handle = /** @type {DOMHandle} */ ([range.start, range.end]);
    Reflect.set(
      fragment,
      HYDRATION_FRAGMENT_CHILDREN,
      this.#getHandleNodes(handle)
    );

    Reflect.set(handle, HYDRATION_HANDLE_STATE, {
      fragment,
      frame: range,
      phase: 'initial',
    });
    return handle;
  }

  /**
   * @param {DOMHandle} segment
   * @param {Node[]} newContent
   */
  write(segment, newContent) {
    const nodes = newContent.flatMap((node) =>
      this.isGroup(node) ? this.#getFragmentChildren(node) : node
    );
    const state = /** @type {HydrationHandleState | undefined} */ (
      Reflect.get(segment, HYDRATION_HANDLE_STATE)
    );

    if (this.#hydrating && state?.phase) {
      if (state.phase === 'ignore-write') {
        state.phase = 'initial';
        return;
      }
      if (nodes.some((node) => !this.#isClaimed(node) && !node.isConnected)) {
        throw new HydrationMismatchError('Unexpected dynamic range content.');
      }
      state.phase = undefined;
      return;
    }

    if (
      this.#hydrating &&
      !state?.client &&
      nodes.some((node) => !this.#isClaimed(node))
    ) {
      throw new HydrationMismatchError('Unexpected dynamic range content.');
    }

    const result = Ops.write(segment, nodes);
    if (state?.fragment) {
      Reflect.set(state.fragment, HYDRATION_FRAGMENT_CHILDREN, [
        segment[0],
        ...nodes,
        segment[1],
      ]);
    }
    if (this.#hydrating && state?.client) {
      for (const node of nodes) this.#markClientNode(node);
    }
    return result;
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
    const state = /** @type {HydrationHandleState | undefined} */ (
      Reflect.get(segment, HYDRATION_HANDLE_STATE)
    );
    if (this.#hydrating) {
      for (const item of options.newCache.values()) {
        for (const node of item.nodes) {
          if (!this.#isClaimed(node) && !node.isConnected && !state?.client) {
            throw new HydrationMismatchError('Unexpected list content.');
          }
          if (state?.client) this.#markClientNode(node);
        }
      }
    }
    if (this.#hydrating && state?.phase) {
      state.phase = undefined;
      return;
    }

    const result = Ops.reconcile(segment, options, this);
    if (state?.fragment) {
      Reflect.set(
        state.fragment,
        HYDRATION_FRAGMENT_CHILDREN,
        this.#getHandleNodes(segment)
      );
    }
    return result;
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
   * @param {StateSnapshot} [snapshot]
   * @param {JSX.JSXDevFileData} [fileData]
   * @returns {Node | Node[]}
   */
  handleComponent(tagname, props, snapshot, fileData) {
    const handle = /** @type {DOMHandle | undefined} */ (
      snapshot?.data?.handle
    );
    const state = /** @type {HydrationHandleState | undefined} */ (
      handle && Reflect.get(handle, HYDRATION_HANDLE_STATE)
    );
    const frame = this.#hydrating ? state?.frame : undefined;
    const initial = Boolean(frame && state?.phase);
    const speculative = Boolean(initial && frame?.nextChild === frame?.end);
    const provisional = Boolean(speculative && state?.phase === 'rendered');
    if (provisional && state) state.phase = 'ignore-write';

    const client = Boolean(state?.client || (frame && !state?.phase));
    if (client && state) state.client = true;
    if (this.#hydrating && handle && !frame && !client) {
      throw new HydrationMismatchError('Missing dynamic range ownership.');
    }
    if (frame && handle && !speculative && !client) {
      if (frame.nextChild === frame.end)
        frame.nextChild = handle[0].nextSibling;
      this.#hydrationStack.push(frame);
    }

    const wasHydrating = this.#hydrating;
    if (speculative || client) this.#hydrating = false;
    try {
      // @ts-expect-error: Vite types are not ingrained
      if (import.meta.env?.DEV) {
        return withHMRBoundaries(tagname, props, fileData, this);
      }
      // @ts-expect-error: Rspack types are not ingrained
      if (import.meta.webpackHot) {
        return withHMRBoundaries(tagname, props, fileData, this);
      }
      const nodes = createNodesFromTemplate(tagname(...props), this);
      return nodes.length === 1 ? nodes[0] : nodes;
    } finally {
      this.#hydrating = wasHydrating;
      if (initial && state && !provisional) state.phase = 'rendered';
      if (frame && !speculative && !client) {
        this.#removeFrameAndDescendants(frame);
      }
    }
  }

  /**
   * @param {Node} _parentNode
   * @param {Node | Node[]} childNode
   */
  append(_parentNode, childNode) {
    const parentNode = /** @type {Element | DocumentFragment | ShadowRoot} */ (
      _parentNode
    );

    if (this.#hydrating && childNode instanceof Ops.ShadowRootFragment) {
      const HTMLElementCtor = /** @type {typeof HTMLElement | undefined} */ (
        /** @type {*} */ (this.host).HTMLElement
      );
      if (HTMLElementCtor && parentNode instanceof HTMLElementCtor) {
        const elementParent = /** @type {HTMLElement} */ (parentNode);
        const shadowRoot =
          elementParent.shadowRoot ??
          elementParent.attachShadow({ mode: 'open' });
        const frame = {
          parent: shadowRoot,
          nextChild: shadowRoot.firstChild,
        };
        this.#hydrationStack.push(frame);
        try {
          return Ops.appendShadowRoot(elementParent, childNode, this);
        } finally {
          this.#removeFrameAndDescendants(frame);
        }
      }
    }

    const shadowRoot = Ops.appendShadowRoot(parentNode, childNode, this);
    if (shadowRoot) return shadowRoot;

    if (this.#hydrating) {
      return this.#appendDuringHydration(parentNode, childNode);
    }

    parentNode.append(
      ...(Array.isArray(childNode) ? childNode.filter(Boolean) : [childNode])
    );

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
    return this.#getFragmentChildren(group);
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

    const hasChildren = Boolean(
      props && tagname !== 'retend-teleport' && 'children' in props
    );
    /** @type {HydrationFrame | null} */
    let hydrationFrame = null;
    if (hasChildren) {
      const childNamespace = tagname === 'foreignObject' ? HTML_NAMESPACE : ns;
      const children = props.children;
      props.children = () => {
        try {
          return NamespaceScope.Provider({
            value: childNamespace,
            children: () => children,
            h: false,
          });
        } finally {
          if (hydrationFrame) this.#removeFrameAndDescendants(hydrationFrame);
        }
      };
    }

    if (this.#hydrating) {
      const claimed = this.#claimHydrationChild((node) => {
        if (node.nodeType !== ELEMENT_NODE) return false;
        const element = /** @type {Element} */ (node);
        return element.namespaceURI === ns && element.localName === tagname;
      }, `expected <${tagname}>`);
      const element = /** @type {JsxElement} */ (claimed);
      if (props?.dangerouslySetInnerHTML?.__html !== undefined) {
        Reflect.get(element, HYDRATION_CLAIM).opaque = true;
      }
      if (hasChildren) hydrationFrame = this.#pushContainerFrame(element);
      return element;
    }

    return /** @type {JsxElement} */ (
      /** @type {unknown} */ (this.host.document.createElementNS(ns, tagname))
    );
  }

  /**
   * @param {string} text
   * @returns {Text}
   */
  createText(text, _isReactive = false, isPending = false) {
    if (this.#hydrating) {
      const nextText = String(text);
      const claimed = this.#claimHydrationChild(
        (node) =>
          node.nodeType === TEXT_NODE ||
          (node.nodeType === COMMENT_NODE &&
            node.textContent === 'retend:empty-text'),
        'expected text'
      );
      let textNode;
      if (claimed.nodeType === COMMENT_NODE) {
        textNode = this.host.document.createTextNode('');
        claimed.replaceWith(textNode);
        Reflect.set(
          textNode,
          HYDRATION_CLAIM,
          Reflect.get(claimed, HYDRATION_CLAIM)
        );
      } else {
        textNode = /** @type {Text} */ (claimed);
      }
      if (!isPending || textNode.textContent === '')
        textNode.textContent = nextText;
      return textNode;
    }
    return this.host.document.createTextNode(String(text));
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
   * @param {(node?: Node, canDefer?: boolean) => Promise<*> | *} callback
   * @param {string} [id]
   */
  scheduleTeleport(callback, id) {
    if (this.#hydrating) {
      const anchorNode = /** @type {Comment} */ (
        this.#claimHydrationChild(
          (node) =>
            node.nodeType === COMMENT_NODE &&
            Boolean(node.textContent?.startsWith(TELEPORT_ANCHOR_PREFIX)),
          'expected teleport anchor'
        )
      );
      const snapshot = branchState();
      this.#pendingHydrationTeleports.push(async () => {
        const stackDepth = this.#hydrationStack.length;
        try {
          return await withState(snapshot, () => callback(anchorNode, true));
        } finally {
          this.#hydrationStack.splice(stackDepth);
        }
      });
      return anchorNode;
    }

    const anchorNode = this.host.document.createComment(
      id ? `${TELEPORT_ANCHOR_PREFIX}${id}` : 'retend:teleport'
    );
    const ref = Cell.source(anchorNode);
    const snapshot = branchState();
    onConnected(
      ref,
      (node) => withState(snapshot, () => callback(node, false)) || undefined
    );
    return anchorNode;
  }

  /** @param {ParentNode} root */
  enableHydrationMode(root) {
    this.#hydrating = true;
    this.#hydrationRoots = [root];
    this.#hydrationStack = [{ parent: root, nextChild: root.firstChild }];
    this.#pendingHydrationTeleports = [];
  }

  async endHydration() {
    try {
      let stalled = false;
      while (true) {
        const pending = this.#pendingHydrationTeleports.splice(0);
        let resolved = 0;
        for (const mount of pending) {
          const result = await mount();
          if (result === false) {
            this.#pendingHydrationTeleports.push(mount);
          } else {
            resolved++;
          }
        }
        await waitForAsyncBoundaries();
        if (!this.#pendingHydrationTeleports.length) break;
        if (!resolved && stalled) {
          throw new HydrationMismatchError('Unresolved Teleport target.');
        }
        stalled = resolved === 0;
      }

      for (const root of this.#hydrationRoots) {
        this.#assertClaimedChildren(root);
      }
    } finally {
      this.#hydrating = false;
      this.#hydrationRoots = [];
      this.#hydrationStack = [];
      this.#pendingHydrationTeleports = [];
    }
    await runPendingSetupEffects();
    this.host.dispatchEvent(new Event('hydrationcompleted'));
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
  }

  /**
   * @param {ParentNode} target
   * @param {string} id
   * @returns {Element | null}
   */
  claimHydrationTeleportContainer(target, id) {
    if (!this.#hydrating) return null;
    const container = Array.from(
      target.querySelectorAll('retend-teleport')
    ).find((candidate) => candidate.getAttribute('data-teleport-id') === id);
    if (!container) {
      throw new HydrationMismatchError('Missing Teleport container.');
    }
    this.#markClaimed(container);
    this.#hydrationRoots.push(container);
    this.#pushContainerFrame(container);
    return container;
  }

  /**
   * @param {ParentNode} parentNode
   * @param {Node | Node[]} childNode
   */
  #appendDuringHydration(parentNode, childNode) {
    const children = Array.isArray(childNode)
      ? childNode.filter(Boolean)
      : [childNode];
    const flatChildren = children.flatMap((child) =>
      this.isGroup(child) ? this.#getFragmentChildren(child) : child
    );

    if (parentNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
      const stored = [
        ...(Reflect.get(parentNode, HYDRATION_FRAGMENT_CHILDREN) ?? []),
      ];
      for (const child of flatChildren) {
        if (!this.#isClaimed(child) && !child.isConnected) {
          throw new HydrationMismatchError('Unexpected inserted node.');
        }
        stored.push(child);
      }
      Reflect.set(parentNode, HYDRATION_FRAGMENT_CHILDREN, stored);
      return parentNode;
    }

    for (const child of flatChildren) {
      if (child === parentNode || child.parentNode === parentNode) continue;
      const position = /** @type {HydrationClaim | undefined} */ (
        Reflect.get(child, HYDRATION_CLAIM)
      );
      if (!this.#isClaimed(child) || position?.parent !== parentNode) {
        throw new HydrationMismatchError('Unexpected inserted node.');
      }
      const before =
        position.before?.parentNode === parentNode ? position.before : null;
      if (before) before.before(child);
      else parentNode.append(child);
    }
    return parentNode;
  }

  /**
   * @param {DOMHandle} handle
   * @returns {Node[]}
   */
  #getHandleNodes(handle) {
    /** @type {Node[]} */
    const nodes = [handle[0]];
    for (
      let node = handle[0].nextSibling;
      node && node !== handle[1];
      node = node.nextSibling
    ) {
      nodes.push(node);
    }
    nodes.push(handle[1]);
    return nodes;
  }

  /**
   * @param {DocumentFragment} fragment
   * @returns {Node[]}
   */
  #getFragmentChildren(fragment) {
    return (
      Reflect.get(fragment, HYDRATION_FRAGMENT_CHILDREN) ??
      Array.from(fragment.childNodes)
    );
  }

  /** @param {ParentNode} parent */
  #pushContainerFrame(parent) {
    const frame = { parent, nextChild: parent.firstChild };
    this.#hydrationStack.push(frame);
    return frame;
  }

  /** @param {HydrationFrame} frame */
  #removeFrameAndDescendants(frame) {
    const index = this.#hydrationStack.indexOf(frame);
    if (index >= 0) this.#hydrationStack.splice(index);
  }

  /** @returns {HydrationFrame | null} */
  #currentHydrationFrame() {
    while (this.#hydrationStack.length > 1) {
      const top = this.#hydrationStack[this.#hydrationStack.length - 1];
      if (top.end || top.nextChild !== null) return top;
      this.#hydrationStack.pop();
    }
    return this.#hydrationStack[0] ?? null;
  }

  /**
   * @param {HydrationFrame} frame
   * @returns {ChildNode | null}
   */
  #skipHydrationSeparators(frame) {
    if (frame.nextChild && frame.nextChild.parentNode !== frame.parent) {
      throw new HydrationMismatchError('Hydration cursor was displaced.');
    }
    while (
      frame.nextChild?.nodeType === COMMENT_NODE &&
      frame.nextChild.textContent === 'retend:text-separator'
    ) {
      this.#markClaimed(frame.nextChild);
      frame.nextChild = frame.nextChild.nextSibling;
    }
    return frame.nextChild;
  }

  /**
   * @param {HydrationFrame} frame
   * @returns {HydrationRange | null}
   */
  #enterImmediateRange(frame) {
    const node = this.#skipHydrationSeparators(frame);
    if (
      node?.nodeType !== COMMENT_NODE ||
      node.textContent !== 'retend:range-start'
    ) {
      return null;
    }

    const start = /** @type {Comment} */ (node);
    let end = /** @type {Comment | undefined} */ (
      Reflect.get(start, HYDRATION_RANGE_END)
    );
    if (!end) {
      const stack = [start];
      for (
        let cursor = start.nextSibling;
        cursor;
        cursor = cursor.nextSibling
      ) {
        if (cursor.nodeType !== COMMENT_NODE) continue;
        const comment = /** @type {Comment} */ (cursor);
        if (comment.textContent === 'retend:range-start') stack.push(comment);
        else if (comment.textContent === 'retend:range-end') {
          const open = stack.pop();
          if (open) Reflect.set(open, HYDRATION_RANGE_END, comment);
          if (!stack.length) {
            end = comment;
            break;
          }
        }
      }
    }
    if (!end) throw new HydrationMismatchError('Unmatched dynamic range.');

    Reflect.set(start, HYDRATION_CLAIM, {
      parent: frame.parent,
      before: start.nextSibling,
    });
    /** @type {HydrationRange} */
    const range = {
      parent: frame.parent,
      nextChild: start.nextSibling,
      start,
      end,
      parentFrame: frame,
    };
    this.#hydrationStack.push(range);
    return range;
  }

  /**
   * @param {(node: ChildNode) => boolean} predicate
   * @param {string} expectation
   * @returns {ChildNode}
   */
  #claimHydrationChild(predicate, expectation) {
    let frame = this.#currentHydrationFrame();
    if (!frame) {
      throw new HydrationMismatchError('Missing structural frame.');
    }

    while (true) {
      const entered = this.#enterImmediateRange(frame);
      if (!entered) break;
      frame = entered;
    }

    const node = this.#skipHydrationSeparators(frame);
    if (!node || node === frame.end || !predicate(node)) {
      throw new HydrationMismatchError(`Hydration error: ${expectation}.`);
    }

    Reflect.set(node, HYDRATION_CLAIM, {
      parent: frame.parent,
      before: node.nextSibling,
    });
    frame.nextChild = node.nextSibling;
    return node;
  }

  /** @param {Node | null | undefined} node */
  #isClaimed(node) {
    return Boolean(node && Reflect.has(node, HYDRATION_CLAIM));
  }

  /** @param {Node | null | undefined} node */
  #markClaimed(node) {
    if (node && !this.#isClaimed(node))
      Reflect.set(node, HYDRATION_CLAIM, true);
  }

  /** @param {Node} node */
  #markClientNode(node) {
    if (node.nodeType !== ELEMENT_NODE) return this.#markClaimed(node);
    const claim = Reflect.get(node, HYDRATION_CLAIM);
    if (claim && typeof claim === 'object') claim.opaque = true;
    else Reflect.set(node, HYDRATION_CLAIM, { opaque: true });
  }

  /** @param {ParentNode} parent */
  #assertClaimedChildren(parent) {
    if (Reflect.get(parent, HYDRATION_CLAIM)?.opaque) return;
    for (const node of parent.childNodes) {
      if (!this.#isClaimed(node)) {
        throw new HydrationMismatchError('Unclaimed server node.');
      }

      if (node.nodeType === ELEMENT_NODE) {
        const element = /** @type {Element} */ (node);
        this.#assertClaimedChildren(element);
        if (element.shadowRoot) this.#assertClaimedChildren(element.shadowRoot);
      }
    }
  }
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
