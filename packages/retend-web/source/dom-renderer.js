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
const HYDRATION = Symbol();
/** @type {(value: any) => any} */
const getHydrationData = (value) => value?.[HYDRATION];
/** @type {(value: any) => any} */
const hydrationData = (value) => (value[HYDRATION] ??= {});

class HydrationMismatchError extends Error {}

/**
 * @typedef {Element & HiddenElementProperties} JsxElement
 * @typedef {[ConnectedComment, ConnectedComment]} DOMHandle
 * @typedef {Renderer<DOMRenderingTypes>} DOMRendererInterface
 * @typedef {{ parent: ParentNode, nextChild: ChildNode | null, parentFrame?: HydrationFrame, end?: Comment, start?: Comment, claimed?: boolean }} HydrationFrame
 * @typedef {HydrationFrame & { start: Comment, end: Comment, parentFrame: HydrationFrame }} HydrationRange
 * @typedef {{ parent?: ParentNode, before?: ChildNode | null, opaque?: boolean }} HydrationClaim
 * @typedef {{ roots: ParentNode[], frame: HydrationFrame | null, teleports: Array<() => Promise<unknown> | unknown> }} HydrationContext
 * @typedef {{ fragment?: DocumentFragment, frame?: HydrationFrame, phase?: 1 | 2 | 3, client?: boolean }} HydrationHandleState
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
  /** @type {HydrationContext | null} */
  #hydration = null;
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
    if (this.#hydration?.frame) queueMicrotask(() => this.observer?.flush());
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
    const hydration = this.#hydration;
    if (!hydration?.frame) {
      const handle = Ops.createGroupHandle(fragment, this);
      if (hydration) hydrationData(handle).client = true;
      return handle;
    }

    const frame = this.#currentHydrationFrame();
    const range =
      frame?.start && !frame.claimed
        ? /** @type {HydrationRange} */ (frame)
        : frame && this.#enterImmediateRange(frame);
    if (!range) throw new HydrationMismatchError('Expected a dynamic range.');
    range.claimed = true;
    if (
      this.#getFragmentChildren(fragment).some((node) => !this.#isClaimed(node))
    ) {
      throw new HydrationMismatchError('Unexpected dynamic range content.');
    }

    hydrationData(range.end).claim = {
      parent: range.parentFrame.parent,
      before: range.end.nextSibling,
    };
    range.parentFrame.nextChild = range.end.nextSibling;
    hydration.frame = range.parentFrame;

    const handle = /** @type {DOMHandle} */ ([range.start, range.end]);
    hydrationData(fragment).children = this.#getHandleNodes(handle);
    Object.assign(hydrationData(handle), {
      fragment,
      frame: range,
      phase: 1,
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
      getHydrationData(segment)
    );
    const hydrating = Boolean(this.#hydration?.frame);

    if (hydrating && state?.phase) {
      if (state.phase === 3) {
        state.phase = 1;
        return;
      }
      if (nodes.some((node) => !this.#isClaimed(node) && !node.isConnected)) {
        throw new HydrationMismatchError('Unexpected dynamic range content.');
      }
      state.phase = undefined;
      return;
    }

    if (
      hydrating &&
      !state?.client &&
      nodes.some((node) => !this.#isClaimed(node))
    ) {
      throw new HydrationMismatchError('Unexpected dynamic range content.');
    }

    const result = Ops.write(segment, nodes);
    if (state?.fragment) {
      hydrationData(state.fragment).children = [
        segment[0],
        ...nodes,
        segment[1],
      ];
    }
    if (hydrating && state?.client) {
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
      getHydrationData(segment)
    );
    if (this.#hydration?.frame) {
      for (const { nodes } of options.newCache.values()) {
        for (const node of nodes) {
          if (!this.#isClaimed(node) && !node.isConnected && !state?.client) {
            throw new HydrationMismatchError('Unexpected list content.');
          }
          if (state?.client) this.#markClientNode(node);
        }
      }
      if (state?.phase) {
        state.phase = undefined;
        return;
      }
    }

    const result = Ops.reconcile(segment, options, this);
    if (state?.fragment) {
      hydrationData(state.fragment).children = this.#getHandleNodes(segment);
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
      handle && getHydrationData(handle)
    );
    const hydration = this.#hydration;
    const cursor = hydration?.frame;
    const frame = cursor ? state?.frame : undefined;
    const phase = frame && state?.phase;
    const speculative = Boolean(phase && frame.nextChild === frame.end);
    const provisional = speculative && phase === 2;
    if (provisional && state) state.phase = 3;

    const client = Boolean(state?.client || (frame && !phase));
    if (client && state) state.client = true;
    if (cursor && handle && !frame && !client) {
      throw new HydrationMismatchError('Missing dynamic range ownership.');
    }
    if (hydration && frame && handle && !speculative && !client) {
      if (frame.nextChild === frame.end)
        frame.nextChild = handle[0].nextSibling;
      hydration.frame = frame;
    } else if (hydration && (speculative || client)) {
      hydration.frame = null;
    }

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
      if (phase && state && !provisional) state.phase = 2;
      if (hydration) {
        if (speculative || client) hydration.frame = cursor ?? null;
        else if (frame?.parentFrame) hydration.frame = frame.parentFrame;
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
    const hydration = this.#hydration;

    if (hydration?.frame && childNode instanceof Ops.ShadowRootFragment) {
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
          parentFrame: /** @type {HydrationFrame} */ (hydration.frame),
        };
        hydration.frame = frame;
        try {
          return Ops.appendShadowRoot(elementParent, childNode, this);
        } finally {
          hydration.frame = frame.parentFrame;
        }
      }
    }

    const shadowRoot = Ops.appendShadowRoot(parentNode, childNode, this);
    if (shadowRoot) return shadowRoot;
    if (hydration?.frame)
      return this.#appendDuringHydration(parentNode, childNode);

    parentNode.append(...[childNode].flat().filter(Boolean));
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
          if (hydrationFrame?.parentFrame && this.#hydration)
            this.#hydration.frame = hydrationFrame.parentFrame;
        }
      };
    }

    if (this.#hydration?.frame) {
      const claimed = this.#claimHydrationChild((node) => {
        if (node.nodeType !== ELEMENT_NODE) return false;
        const element = /** @type {Element} */ (node);
        return element.namespaceURI === ns && element.localName === tagname;
      }, `expected <${tagname}>`);
      const element = /** @type {JsxElement} */ (claimed);
      if (props?.dangerouslySetInnerHTML?.__html !== undefined) {
        hydrationData(element).claim.opaque = true;
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
    if (this.#hydration?.frame) {
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
        hydrationData(textNode).claim = getHydrationData(claimed).claim;
      } else {
        textNode = /** @type {Text} */ (claimed);
      }
      if (!isPending || textNode.textContent === '')
        textNode.textContent = String(text);
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
    const hydration = this.#hydration;
    if (hydration?.frame) {
      const anchorNode = /** @type {Comment} */ (
        this.#claimHydrationChild(
          (node) =>
            node.nodeType === COMMENT_NODE &&
            Boolean(node.textContent?.startsWith(TELEPORT_ANCHOR_PREFIX)),
          'expected teleport anchor'
        )
      );
      const snapshot = branchState();
      hydration.teleports.push(async () => {
        const frame = hydration.frame;
        try {
          return await withState(snapshot, () => callback(anchorNode, true));
        } finally {
          hydration.frame = frame;
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
    this.#hydration = {
      roots: [root],
      frame: { parent: root, nextChild: root.firstChild },
      teleports: [],
    };
  }

  async endHydration() {
    const hydration = this.#hydration;
    if (!hydration) return;
    try {
      let stalled = false;
      do {
        const pending = hydration.teleports.splice(0);
        let resolved = 0;
        for (const mount of pending) {
          if ((await mount()) === false) hydration.teleports.push(mount);
          else resolved++;
        }
        await waitForAsyncBoundaries();
        if (hydration.teleports.length && !resolved && stalled) {
          throw new HydrationMismatchError('Unresolved Teleport target.');
        }
        stalled = resolved === 0;
      } while (hydration.teleports.length);

      for (const root of hydration.roots) this.#assertClaimedChildren(root);
    } finally {
      this.#hydration = null;
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
    const hydration = this.#hydration;
    if (!hydration?.frame) return null;
    const container = Array.from(
      target.querySelectorAll('retend-teleport')
    ).find((candidate) => candidate.getAttribute('data-teleport-id') === id);
    if (!container) {
      throw new HydrationMismatchError('Missing Teleport container.');
    }
    this.#markClaimed(container);
    hydration.roots.push(container);
    this.#pushContainerFrame(container);
    return container;
  }

  /**
   * @param {ParentNode} parentNode
   * @param {Node | Node[]} childNode
   */
  #appendDuringHydration(parentNode, childNode) {
    const children = (Array.isArray(childNode) ? childNode : [childNode])
      .filter(Boolean)
      .flatMap((child) =>
        this.isGroup(child) ? this.#getFragmentChildren(child) : child
      );

    if (parentNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
      if (
        children.some((node) => !this.#isClaimed(node) && !node.isConnected)
      ) {
        throw new HydrationMismatchError('Unexpected inserted node.');
      }
      (hydrationData(parentNode).children ??= []).push(...children);
      return parentNode;
    }

    for (const child of children) {
      if (child === parentNode || child.parentNode === parentNode) continue;
      const position = /** @type {HydrationClaim | undefined} */ (
        getHydrationData(child)?.claim
      );
      if (!position || position.parent !== parentNode) {
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
    const nodes = [];
    for (
      let node = /** @type {ChildNode | null} */ (handle[0]);
      node;
      node = node.nextSibling
    ) {
      nodes.push(node);
      if (node === handle[1]) break;
    }
    return nodes;
  }

  /**
   * @param {DocumentFragment} fragment
   * @returns {Node[]}
   */
  #getFragmentChildren(fragment) {
    return (
      getHydrationData(fragment)?.children ?? Array.from(fragment.childNodes)
    );
  }

  /** @param {ParentNode} parent */
  #pushContainerFrame(parent) {
    const hydration = /** @type {HydrationContext} */ (this.#hydration);
    const frame = {
      parent,
      nextChild: parent.firstChild,
      parentFrame: /** @type {HydrationFrame} */ (hydration.frame),
    };
    hydration.frame = frame;
    return frame;
  }

  /** @returns {HydrationFrame | null} */
  #currentHydrationFrame() {
    const hydration = this.#hydration;
    let frame = hydration?.frame;
    while (frame?.parentFrame && !frame.end && frame.nextChild === null) {
      frame = frame.parentFrame;
    }
    if (hydration && frame) hydration.frame = frame;
    return frame ?? null;
  }

  /**
   * @param {HydrationFrame} frame
   * @returns {ChildNode | null}
   */
  #skipHydrationSeparators(frame) {
    let node = frame.nextChild;
    if (node && node.parentNode !== frame.parent) {
      throw new HydrationMismatchError('Hydration cursor was displaced.');
    }
    while (
      node?.nodeType === COMMENT_NODE &&
      node.textContent === 'retend:text-separator'
    ) {
      this.#markClaimed(node);
      node = node.nextSibling;
    }
    return (frame.nextChild = node);
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
    let end = /** @type {Comment | undefined} */ (getHydrationData(start)?.end);
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
          if (open) hydrationData(open).end = comment;
          if (!stack.length) {
            end = comment;
            break;
          }
        }
      }
    }
    if (!end) throw new HydrationMismatchError('Unmatched dynamic range.');

    hydrationData(start).claim = {
      parent: frame.parent,
      before: start.nextSibling,
    };
    /** @type {HydrationRange} */
    const range = {
      parent: frame.parent,
      nextChild: start.nextSibling,
      start,
      end,
      parentFrame: frame,
    };
    /** @type {HydrationContext} */ (this.#hydration).frame = range;
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

    hydrationData(node).claim = {
      parent: frame.parent,
      before: node.nextSibling,
    };
    frame.nextChild = node.nextSibling;
    return node;
  }

  /** @param {Node | null | undefined} node */
  #isClaimed(node) {
    return Boolean(node && getHydrationData(node)?.claim);
  }

  /** @param {Node | null | undefined} node */
  #markClaimed(node) {
    if (node) hydrationData(node).claim ??= true;
  }

  /** @param {Node} node */
  #markClientNode(node) {
    const claim = (hydrationData(node).claim ??= {});
    if (node.nodeType === ELEMENT_NODE) claim.opaque = true;
  }

  /** @param {ParentNode} parent */
  #assertClaimedChildren(parent) {
    if (getHydrationData(parent)?.claim?.opaque) return;
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
  element.append(...[root].flat());
  runPendingSetupEffects();
}
