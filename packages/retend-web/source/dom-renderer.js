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
const TELEPORT_CANCELED = Symbol.for('retend.teleport.canceled');
const TELEPORT_DEFERRED = Symbol.for('retend.teleport.deferred');

class HydrationMismatchError extends Error {}

/**
 * @typedef {Element & HiddenElementProperties} JsxElement
 * @typedef {[ConnectedComment, ConnectedComment]} DOMHandle
 * @typedef {Renderer<DOMRenderingTypes>} DOMRendererInterface
 * @typedef {{ parent: ParentNode, nextChild: ChildNode | null, end?: Comment | null, container?: ParentNode | null, range?: HydrationRange | null }} HydrationFrame
 * @typedef {{ start: Comment, end: Comment, frame: HydrationFrame, parentFrame: HydrationFrame }} HydrationRange
 * @typedef {{ parent: ParentNode, before: ChildNode | null }} HydrationPosition
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
  /** @type {WeakMap<Comment, Comment>} */
  #hydrationRangeEnds = new WeakMap();
  /** @type {Set<HydrationRange>} */
  #unclaimedHydrationRanges = new Set();
  #claimedNodes = new WeakSet();
  /** @type {WeakMap<Node, HydrationPosition>} */
  #claimedPositions = new WeakMap();
  /** @type {WeakMap<DocumentFragment, Node[]>} */
  #fragmentChildren = new WeakMap();
  /** @type {WeakMap<DOMHandle, DocumentFragment>} */
  #hydrationHandleFragments = new WeakMap();
  /** @type {WeakMap<DOMHandle, HydrationFrame>} */
  #hydrationHandleFrames = new WeakMap();
  #initialHydrationWrites = new WeakSet();
  /** @type {WeakMap<DOMHandle, 'rendered' | 'ignore-write'>} */
  #initialHydrationRenderState = new WeakMap();
  #clientUpdatedHandles = new WeakSet();
  #clientRenderedNodes = new WeakSet();
  /** @type {WeakSet<Element>} */
  #opaqueHydrationContainers = new WeakSet();
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
      if (this.#hydrationStack.length) this.#clientUpdatedHandles.add(handle);
      return handle;
    }

    const range = this.#claimRangeForHandle();
    if (!range) throw new HydrationMismatchError('Expected a dynamic range.');

    const children = this.#getFragmentChildren(fragment);
    for (const child of children) {
      if (!this.#isClaimed(child)) {
        throw new HydrationMismatchError('Unexpected dynamic range content.');
      }
    }

    this.#markClaimed(range.end);
    this.#claimedPositions.set(range.end, {
      parent: range.parentFrame.parent,
      before: range.end.nextSibling,
    });
    range.parentFrame.nextChild = range.end.nextSibling;
    this.#removeFrameAndDescendants(range.frame);
    /** @type {Node[]} */
    const groupChildren = [range.start];
    let child = range.start.nextSibling;
    while (child && child !== range.end) {
      groupChildren.push(child);
      child = child.nextSibling;
    }
    groupChildren.push(range.end);
    this.#fragmentChildren.set(fragment, groupChildren);
    const handle = /** @type {DOMHandle} */ ([range.start, range.end]);
    this.#hydrationHandleFragments.set(handle, fragment);
    this.#hydrationHandleFrames.set(handle, range.frame);
    this.#initialHydrationWrites.add(handle);
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
    if (this.#hydrating && this.#initialHydrationWrites.has(segment)) {
      if (this.#initialHydrationRenderState.get(segment) === 'ignore-write') {
        this.#initialHydrationRenderState.delete(segment);
        return;
      }
      if (nodes.some((node) => !this.#isClaimed(node) && !node.isConnected)) {
        throw new HydrationMismatchError('Unexpected dynamic range content.');
      }
      this.#initialHydrationWrites.delete(segment);
      this.#initialHydrationRenderState.delete(segment);
      return;
    }

    const isClientUpdate = this.#clientUpdatedHandles.has(segment);
    if (
      this.#hydrating &&
      !isClientUpdate &&
      nodes.some((node) => !this.#isClaimed(node))
    ) {
      throw new HydrationMismatchError('Unexpected dynamic range content.');
    }

    const result = Ops.write(segment, nodes);
    const fragment = this.#hydrationHandleFragments.get(segment);
    if (fragment) {
      this.#fragmentChildren.set(fragment, [segment[0], ...nodes, segment[1]]);
    }
    if (this.#hydrating && isClientUpdate) {
      for (const node of nodes) this.#clientRenderedNodes.add(node);
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
    const isInitialHydrationWrite =
      this.#hydrating && this.#initialHydrationWrites.has(segment);
    const isClientUpdate = this.#clientUpdatedHandles.has(segment);
    if (this.#hydrating) {
      for (const item of options.newCache.values()) {
        for (const node of item.nodes) {
          if (!this.#isClaimed(node) && !node.isConnected && !isClientUpdate) {
            throw new HydrationMismatchError('Unexpected list content.');
          }
          if (!this.#isClaimed(node) && isClientUpdate) {
            this.#clientRenderedNodes.add(node);
          }
        }
      }
    }
    if (isInitialHydrationWrite) {
      this.#initialHydrationWrites.delete(segment);
      return;
    }

    const result = Ops.reconcile(segment, options, this);
    const fragment = this.#hydrationHandleFragments.get(segment);
    if (fragment) {
      /** @type {Node[]} */
      const nodes = [segment[0]];
      let node = segment[0].nextSibling;
      while (node && node !== segment[1]) {
        nodes.push(node);
        node = node.nextSibling;
      }
      nodes.push(segment[1]);
      this.#fragmentChildren.set(fragment, nodes);
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
    const frame =
      this.#hydrating && handle
        ? this.#hydrationHandleFrames.get(handle)
        : undefined;
    const isInitialHydrationRender = Boolean(
      frame && handle && this.#initialHydrationWrites.has(handle)
    );
    const isSpeculativeInitialRender = Boolean(
      isInitialHydrationRender && frame?.nextChild === frame?.end
    );
    const isProvisionalInitialRender = Boolean(
      isSpeculativeInitialRender &&
      handle &&
      this.#initialHydrationRenderState.get(handle) === 'rendered'
    );
    if (isProvisionalInitialRender && handle) {
      this.#initialHydrationRenderState.set(handle, 'ignore-write');
    }
    const isClientUpdate = Boolean(
      handle &&
      (this.#clientUpdatedHandles.has(handle) ||
        (frame && !this.#initialHydrationWrites.has(handle)))
    );
    if (isClientUpdate && handle) this.#clientUpdatedHandles.add(handle);
    if (this.#hydrating && handle && !frame && !isClientUpdate) {
      throw new HydrationMismatchError('Missing dynamic range ownership.');
    }
    if (frame && handle && !isSpeculativeInitialRender && !isClientUpdate) {
      if (frame.nextChild === frame.end) {
        frame.nextChild = handle[0].nextSibling;
      }
      this.#hydrationStack.push(frame);
    }
    const wasHydrating = this.#hydrating;
    if (isSpeculativeInitialRender || isClientUpdate) this.#hydrating = false;
    try {
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
    } finally {
      this.#hydrating = wasHydrating;
      if (isInitialHydrationRender && handle && !isProvisionalInitialRender) {
        this.#initialHydrationRenderState.set(handle, 'rendered');
      }
      if (frame && !isSpeculativeInitialRender && !isClientUpdate) {
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
        this.#markClaimed(shadowRoot);
        const frame = {
          parent: shadowRoot,
          nextChild: shadowRoot.firstChild,
          container: shadowRoot,
        };
        this.#hydrationStack.push(frame);
        try {
          return Ops.appendShadowRoot(elementParent, childNode, this);
        } finally {
          const index = this.#hydrationStack.lastIndexOf(frame);
          if (index >= 0) this.#hydrationStack.splice(index, 1);
        }
      }
    }

    const shadowRoot = Ops.appendShadowRoot(parentNode, childNode, this);
    if (shadowRoot) return shadowRoot;

    if (this.#hydrating) {
      return this.#appendDuringHydration(parentNode, childNode);
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
    return this.#fragmentChildren.get(group) ?? Array.from(group.childNodes);
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

    const hasRenderableChildren = this.#hasRenderableChildren(props);
    /** @type {HydrationFrame | null} */
    let hydrationFrame = null;
    if (props && tagname !== 'retend-teleport' && 'children' in props) {
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
          if (hydrationFrame) {
            this.#removeFrameAndDescendants(hydrationFrame);
          }
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
      const html = props?.dangerouslySetInnerHTML?.__html;
      if (html !== undefined) {
        this.#opaqueHydrationContainers.add(element);
      }
      if (hasRenderableChildren) {
        hydrationFrame = this.#pushContainerFrame(element);
      }
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
        this.#markClaimed(textNode);
      } else {
        textNode = /** @type {Text} */ (claimed);
      }
      if (!isPending || textNode.textContent === '') {
        textNode.textContent = nextText;
      }
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
      const anchorNode = this.#claimHydrationTeleportAnchor();
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
    if (id) Reflect.set(anchorNode, '__retendTeleportId', id);
    const ref = Cell.source(anchorNode);
    const snapshot = branchState();
    onConnected(ref, (node) => {
      const result = withState(snapshot, () => callback(node, false));
      if ([TELEPORT_CANCELED, TELEPORT_DEFERRED].includes(result)) return;
      return result;
    });
    return anchorNode;
  }

  /** @param {ParentNode} root */
  enableHydrationMode(root) {
    this.#hydrating = true;
    this.#hydrationStack = [{ parent: root, nextChild: root.firstChild }];
    this.#hydrationRangeEnds = new WeakMap();
    this.#unclaimedHydrationRanges.clear();
    this.#claimedNodes = new WeakSet();
    this.#claimedPositions = new WeakMap();
    this.#hydrationHandleFrames = new WeakMap();
    this.#hydrationHandleFragments = new WeakMap();
    this.#initialHydrationWrites = new WeakSet();
    this.#initialHydrationRenderState = new WeakMap();
    this.#clientUpdatedHandles = new WeakSet();
    this.#clientRenderedNodes = new WeakSet();
    this.#opaqueHydrationContainers = new WeakSet();
    this.#pendingHydrationTeleports = [];
    const roots = [root];
    for (let index = 0; index < roots.length; index++) {
      const rangeRoot = roots[index];
      if (!rangeRoot) continue;
      for (const element of rangeRoot.querySelectorAll('*')) {
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
      const walker = this.host.document.createTreeWalker(rangeRoot, 128);
      /** @type {Comment[]} */
      const stack = [];
      let node = walker.nextNode();
      while (node) {
        const comment = /** @type {Comment} */ (node);
        if (comment.textContent === 'retend:range-start') stack.push(comment);
        else if (comment.textContent === 'retend:range-end') {
          const start = stack.pop();
          if (start) this.#hydrationRangeEnds.set(start, comment);
        }
        node = walker.nextNode();
      }
    }
    this.#hydrationRoots = roots;
  }

  async endHydration() {
    try {
      let stalled = false;
      while (true) {
        const pending = this.#pendingHydrationTeleports.splice(0);
        let resolved = 0;
        for (const mount of pending) {
          const result = await mount();
          if (result === TELEPORT_DEFERRED) {
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

      if (this.#unclaimedHydrationRanges.size) {
        throw new HydrationMismatchError('Unclaimed dynamic range.');
      }

      for (const root of this.#hydrationRoots) {
        if (root !== this.#hydrationRoots[0] && !this.#isClaimed(root)) {
          if (!(/** @type {Node} */ (root).isConnected)) continue;
          throw new HydrationMismatchError('Unclaimed Teleport container.');
        }
        this.#assertClaimedChildren(root);
      }
    } finally {
      this.#hydrating = false;
      this.#hydrationRoots = [];
      this.#hydrationStack = [];
      this.#pendingHydrationTeleports = [];
      this.#unclaimedHydrationRanges.clear();
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
    if (!this.#hydrationRoots.includes(container)) {
      this.#hydrationRoots.push(container);
    }
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
      const existing = this.#fragmentChildren.get(
        /** @type {DocumentFragment} */ (parentNode)
      );
      const stored = existing ? [...existing] : [];
      for (const child of flatChildren) {
        if (!this.#isClaimed(child) && !child.isConnected) {
          throw new HydrationMismatchError('Unexpected inserted node.');
        }
        stored.push(child);
      }
      this.#fragmentChildren.set(
        /** @type {DocumentFragment} */ (parentNode),
        stored
      );
      return parentNode;
    }

    for (const child of flatChildren) {
      if (child === parentNode) continue;
      if (child.parentNode === parentNode) continue;
      const position = this.#claimedPositions.get(child);
      if (!this.#isClaimed(child) || position?.parent !== parentNode) {
        throw new HydrationMismatchError('Unexpected inserted node.');
      }
      const insertionPoint =
        position.before?.parentNode === parentNode ? position.before : null;
      if (insertionPoint) insertionPoint.before(child);
      else parentNode.append(child);
    }
    return parentNode;
  }

  /**
   * @param {DocumentFragment} fragment
   * @returns {Node[]}
   */
  #getFragmentChildren(fragment) {
    return (
      this.#fragmentChildren.get(fragment) ?? Array.from(fragment.childNodes)
    );
  }

  /** @param {ParentNode} parent */
  #pushContainerFrame(parent) {
    const frame = {
      parent,
      nextChild: parent.firstChild,
      container: parent,
    };
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
      if (top.end && top.nextChild === top.end) break;
      if (top.container && top.nextChild === null) {
        this.#hydrationStack.pop();
        continue;
      }
      break;
    }
    return this.#hydrationStack[this.#hydrationStack.length - 1] ?? null;
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
    const end = this.#hydrationRangeEnds.get(start);
    if (!end) {
      throw new HydrationMismatchError('Unmatched dynamic range.');
    }

    this.#markClaimed(start);
    this.#claimedPositions.set(start, {
      parent: frame.parent,
      before: start.nextSibling,
    });
    /** @type {HydrationFrame} */
    const rangeFrame = {
      parent: frame.parent,
      nextChild: start.nextSibling,
      end,
      range: null,
    };
    const range = {
      start,
      end,
      frame: rangeFrame,
      parentFrame: frame,
    };
    rangeFrame.range = range;
    this.#unclaimedHydrationRanges.add(range);
    this.#hydrationStack.push(rangeFrame);
    return range;
  }

  /**
   * @returns {HydrationRange | null}
   */
  #claimRangeForHandle() {
    const frame = this.#currentHydrationFrame();
    if (!frame) return null;
    const range =
      frame.range && this.#unclaimedHydrationRanges.has(frame.range)
        ? frame.range
        : this.#enterImmediateRange(frame);
    if (!range) return null;
    this.#unclaimedHydrationRanges.delete(range);
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
      frame = entered.frame;
    }

    const node = this.#skipHydrationSeparators(frame);
    if (!node || (frame.end && node === frame.end)) {
      throw new HydrationMismatchError(`Hydration error: ${expectation}.`);
    }

    if (!predicate(node)) {
      throw new HydrationMismatchError(`Hydration error: ${expectation}.`);
    }

    this.#claimedPositions.set(node, {
      parent: frame.parent,
      before: node.nextSibling,
    });
    frame.nextChild = node.nextSibling;
    this.#markClaimed(node);
    return node;
  }

  /**
   * @returns {Comment}
   */
  #claimHydrationTeleportAnchor() {
    const claimed = this.#claimHydrationChild(
      (node) =>
        node.nodeType === COMMENT_NODE &&
        Boolean(node.textContent?.startsWith(TELEPORT_ANCHOR_PREFIX)),
      'expected teleport anchor'
    );

    const anchor = /** @type {Comment} */ (claimed);
    Reflect.set(
      anchor,
      '__retendTeleportId',
      anchor.textContent?.slice(TELEPORT_ANCHOR_PREFIX.length)
    );
    return anchor;
  }

  /** @param {Node | null | undefined} node */
  #isClaimed(node) {
    return Boolean(node && this.#claimedNodes.has(node));
  }

  /** @param {Node | null | undefined} node */
  #markClaimed(node) {
    if (node) this.#claimedNodes.add(node);
  }

  /** @param {ParentNode} parent */
  #assertClaimedChildren(parent) {
    if (this.#opaqueHydrationContainers.has(/** @type {Element} */ (parent))) {
      return;
    }
    const ElementCtor = /** @type {typeof Element | undefined} */ (
      /** @type {*} */ (this.host).Element
    );
    for (const node of parent.childNodes) {
      if (this.#clientRenderedNodes.has(node)) continue;
      if (!this.#isClaimed(node)) {
        throw new HydrationMismatchError('Unclaimed server node.');
      }

      if (ElementCtor && node instanceof ElementCtor) {
        const element = /** @type {Element} */ (node);
        this.#assertClaimedChildren(element);
        if (element.shadowRoot) this.#assertClaimedChildren(element.shadowRoot);
      }
    }
  }

  /** @param {Record<string, any> | null | undefined} props */
  #hasRenderableChildren(props) {
    if (!props || !('children' in props)) return false;
    const children = props.children;
    if (children === null || children === undefined || children === false) {
      return false;
    }
    if (Array.isArray(children)) {
      return children.some(
        (child) => child !== null && child !== undefined && child !== false
      );
    }
    return true;
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
