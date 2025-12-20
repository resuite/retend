/** @import { ReconcilerOptions, Renderer } from "retend"; */
/** @import { NodeLike, FragmentLike, WindowLike } from "retend/context"; */
/** @import * as VDom from 'retend/v-dom' */
/** @import { jsxDevFileData, UpdatableFn } from 'retend/hmr'; */
/** @import { ConnectedComment, HiddenElementProperties } from './utils.js'; */

import { Cell, SourceCell } from '@adbl/cells';
import { matchContext, Modes } from 'retend/context';
import {
  connectNodes,
  createNodesFromTemplate,
  normalizeJsxChild,
} from 'retend';
import { withHMRBoundaries } from './plugin/hmr.js';
import {
  addCellListener,
  createCommentPair,
  setAttribute,
  writeStaticStyle,
} from './utils.js';

/**
 * @typedef {(Element | VDom.VElement) & HiddenElementProperties} JsxElement
 * @typedef {[ConnectedComment, ConnectedComment]} DOMHandle
 * @typedef {Renderer<DOMRenderingTypes>} DOMRendererInterface
 * @typedef {{ childNodes: NodeLike[], shadowRoot: ShadowRoot | VDom.VShadowRoot | null, data: any }} SavedInstance
 */

/**
 * @typedef DOMRenderingTypes
 * @property {NodeLike} Output
 * @property {NodeLike} Node
 * @property {NodeLike} Text
 * @property {DOMHandle} Handle
 * @property {FragmentLike} Group
 * @property {JsxElement} Container
 * @property {VDom.VWindow | Window} Host
 * @property {SavedInstance} SavedNodeState
 */

/**
 * @implements {DOMRendererInterface}
 */
export class DOMRenderer {
  /** @type {WindowLike} */
  host;
  capabilities = {};

  /** @param {VDom.VWindow | Window & globalThis} host */
  constructor(host) {
    this.host = host;
    writeStaticStyle(
      'dom-styles',
      ':where(retend-outlet) { display: contents }' +
        ':where(retend-teleport) { display: contents }' +
        ':where(retend-unique-instance) {display: block;width:fit-content;height:fit-content}',
      this.host
    );
    this.capabilities = {
      supportsSetupEffects: matchContext(window, Modes.Interactive),
    };
  }

  /**
   * @param {string} key
   */
  selectMatchingNodes(key) {
    return [...this.host.document.querySelectorAll(key)];
  }

  /**
   * @param {string} key
   */
  selectMatchingNode(key) {
    return this.host.document.querySelector(key);
  }

  /**
   * @param {NodeLike} node
   * @param {any} data
   * @returns {SavedInstance}
   */
  saveContainerState(node, data) {
    if (!(node instanceof this.host.Element)) {
      throw new Error('Cannot save state of non-element node.');
    }
    return {
      childNodes: [...node.childNodes],
      shadowRoot: node.shadowRoot,
      data,
    };
  }

  /**
   * @param {JsxElement} node
   * @param {SavedInstance} data
   */
  restoreContainerState(node, data) {
    this.append(node, data.childNodes);
    if (data.shadowRoot) {
      const { mode, childNodes } = data.shadowRoot;
      const newShadow = node.attachShadow({ mode });
      this.append(newShadow, [...childNodes]);
    }
  }

  /**
   * @param {FragmentLike} fragment
   */
  createGroupHandle(fragment) {
    const handle = createCommentPair();
    Reflect.set(handle[0], '__handle', handle);
    Reflect.set(handle[1], '__handle', handle);
    // @ts-expect-error: Node types get tangled in vdom.
    fragment.replaceChildren(handle[0], ...fragment.childNodes, handle[1]);
    return handle;
  }

  /**
   * @param {DOMHandle} segment
   * @param {NodeLike[]} newContent
   */
  write(segment, newContent) {
    const start = segment[0];
    const end = segment[1];

    let nextNode = start.nextSibling;
    while (nextNode && nextNode !== end) {
      nextNode.remove();
      nextNode = start.nextSibling;
    }
    // @ts-expect-error: Node types get tangled in vdom.
    start.after(...newContent);
  }

  /**
   *
   * @param {DOMHandle} segment
   * @param {ReconcilerOptions<NodeLike>} options
   */
  reconcile(segment, options) {
    const {
      onBeforeNodeRemove,
      retrieveOrSetItemKey,
      cacheFromLastRun,
      onBeforeNodeMove,
      nodeLookAhead,
      newCache,
      newList,
    } = options;
    // Removing Deleted Nodes:
    //
    // This pass is necessary to remove nodes in one go,
    // rather than bubbling them to the end of the list.
    //
    // e.g. Consider a scenario where a list changes from [A, B, C, D, E] to [B, C, D, E]
    // Ideal solution is a removeChild(A), but without this pass, what would happen is:
    //  [A, B, C, D, E] -> [B, A, C, D, E]
    //  [B, A, C, D, E] -> [B, C, A, D, E]
    //  [B, C, A, D, E] -> [B, C, D, A, E]
    //  [B, C, D, A, E] -> [B, C, D, E, A]
    // before removing A, result in a removal and reinsertion of several unchanged nodes.
    for (const [key, value] of cacheFromLastRun) {
      if (newCache.has(key)) continue;
      value.snapshot.node.dispose();
      // There was a previous optimization to try and remove contiguous nodes
      // at once with range.deleteContents(), but it was not worth it.
      for (const node of value.nodes) {
        onBeforeNodeRemove?.(node, value.index.get());
        /** @type {ChildNode} */ (node).remove();
      }
    }

    let lastInserted = segment[0];

    // Reordering and Inserting New Nodes:
    //
    // This pass ensures nodes are in the correct order and new nodes are inserted.
    // It compares each node's current position with the expected position after lastInserted,
    // moving nodes only when necessary to maintain the correct sequence.
    let i = 0;
    const batchAdd = this.host.document.createDocumentFragment();
    const batchAddLike = /** @type {*} */ (batchAdd);
    for (const item of newList) {
      // @ts-ignore: Invariant: nodes is always defined.
      const { nodes } = newCache.get(retrieveOrSetItemKey(item, i));
      const isAlreadyInPosition = lastInserted.nextSibling === nodes[0];
      if (isAlreadyInPosition) {
        if (batchAdd.childNodes.length > 0) lastInserted.after(batchAddLike);
        lastInserted = nodes[nodes.length - 1];
        i++;
        continue;
      }

      // This branch takes care of the case where one item moves
      // forward in the list, but until its correct position is reached, its nodes
      // block other nodes from being correctly positioned, leading to cascading moves.
      //
      // Example: A list goes from [A, B, C, D, E] to [B, C, D, E, A], the simplest
      // operation is to move A to the end of the list, but without this branch,
      // the loop would have to:
      // move B back, making [B, A, C, D, E]
      // move C back, making [B, C, A, D, E]
      // move D back, making [B, C, D, A, E]
      // move E back, making [B, C, D, E, A]
      const followingNode = lastInserted.nextSibling;
      if (followingNode) {
        const data = nodeLookAhead.get(followingNode);
        if (data) {
          const { itemKey, lastItemLastNode } = data;
          const hasViableMoveAnchor =
            lastItemLastNode?.parentNode &&
            lastItemLastNode.parentNode !== batchAdd &&
            lastItemLastNode.nextSibling !== followingNode &&
            lastItemLastNode !== nodes[0];
          if (hasViableMoveAnchor) {
            const fullNodeSet = newCache.get(itemKey)?.nodes;
            if (fullNodeSet) {
              onBeforeNodeMove?.(nodes);
              //@ts-expect-error: after() should be available.
              lastItemLastNode.after(...fullNodeSet);
            }

            // recheck sequential correctness.
            const isAlreadyInPosition = lastInserted.nextSibling === nodes[0];
            if (isAlreadyInPosition) {
              if (batchAdd.childNodes.length) lastInserted.after(batchAddLike);
              lastInserted = nodes[nodes.length - 1];
              i++;
              continue;
            }
          }
        }
      }

      const isNewItemInstance = !nodes[0]?.parentNode;
      if (isNewItemInstance) {
        batchAddLike.append(...nodes);
        i++;
        continue;
      }

      if (batchAdd.childNodes.length === 0) {
        onBeforeNodeMove?.(nodes);
        lastInserted.after(.../** @type {*} */ (nodes));
      } else {
        const newPtr = batchAdd.childNodes[batchAdd.childNodes.length - 1];
        lastInserted.after(batchAddLike);
        onBeforeNodeMove?.(nodes);
        newPtr.after(.../** @type {*} */ (nodes));
      }
      lastInserted = nodes[nodes.length - 1] ?? lastInserted;
      i++;
    }

    if (batchAdd.childNodes.length) lastInserted.after(batchAddLike);
  }

  /**
   * @template {NodeLike} N
   * @param {N} node
   * @param {string} key
   * @param {any} value
   * @returns {N}
   */
  setProperty(node, key, value) {
    // Special Internal Key:
    // Links a VNode to the array that holds it.
    if (key === 'retend:collection') {
      // We assume the VNode implementation allows arbitrary property assignment
      // or we use a weakmap if we want to be stricter.
      // Since we are likely in VDOM mode if this is relevant:
      Reflect.set(node, '__retend_collection_ref', value);
      return node;
    }

    const element = /** @type {JsxElement} */ (node);
    if (Cell.isCell(value)) {
      if (!element.__attributeCells) element.__attributeCells = new Set();
      if (key === 'ref' && value instanceof SourceCell) {
        value.set(element);
        element.__ref = value;
        element.__attributeCells.add(value);
        return node;
      }
      addCellListener(element, value, function (value) {
        setAttribute(this, key, value);
      });
    } else setAttribute(element, key, value);

    return node;
  }

  /**
   * @param {UpdatableFn} tagname
   * @param {any} props
   * @param {jsxDevFileData} [fileData]
   */
  handleComponent(tagname, props, fileData) {
    // @ts-expect-error: Vite types are not ingrained
    if (import.meta.env?.DEV) {
      return withHMRBoundaries(tagname, props, fileData);
    }
    const component = tagname(...props);
    /** @type {NodeLike[]} */
    const nodes = createNodesFromTemplate(component, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  /**
   * @param {NodeLike} parentNode
   * @param {NodeLike | NodeLike[]} childNode
   */
  append(parentNode, childNode) {
    if (
      childNode instanceof this.host.DocumentFragment &&
      '__isShadowRootContainer' in childNode &&
      childNode.__isShadowRootContainer &&
      '__mode' in childNode
    ) {
      if (!(parentNode instanceof this.host.HTMLElement)) {
        console.error('ShadowRoot can only be children of HTML Elements.');
        return parentNode;
      }

      const mode = /** @type {ShadowRootMode} */ (childNode.__mode);
      const shadowRoot =
        parentNode.shadowRoot ?? parentNode.attachShadow({ mode });
      if (shadowRoot.mode !== mode) {
        console.error(
          'Shadowroot mode mismatch: Parent already has a shadowroot of a different type'
        );
        return parentNode;
      }
      connectNodes(shadowRoot, [...childNode.childNodes], this);
      return parentNode;
    }
    const tagname = Reflect.get(parentNode, 'tagName');

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
      matchContext(this.host, Modes.Interactive) &&
      (tagname === 'svg' || tagname === 'math') &&
      childNode instanceof this.host.HTMLElement
    ) {
      const elementNamespace = /** @type {string} */ (
        'namespaceURI' in parentNode
          ? parentNode.namespaceURI
          : 'http://www.w3.org/1999/xhtml'
      );
      const temp = this.host.document.createElementNS(elementNamespace, 'div');
      temp.innerHTML = /** @type {HTMLElement} */ (childNode).outerHTML;
      /** @type {ParentNode} */ (parentNode).append(...temp.children);
      return parentNode;
    }
    if (Array.isArray(childNode)) {
      const children = /** @type {*} */ (childNode.filter(Boolean));
      /** @type {ParentNode} */ (parentNode).append(...children);
    } else {
      /** @type {ParentNode} */ (parentNode).append(
        /** @type {*} */ (childNode)
      );
    }

    return parentNode;
  }

  /**
   * @param {Promise<any>} child
   */
  handlePromise(child) {
    const placeholder = this.host.document.createComment('----');
    Reflect.set(placeholder, '__promise', child);
    child.then((value) => {
      placeholder.replaceWith(
        /** @type {*} */ (normalizeJsxChild(value, this))
      );
    });
    return placeholder;
  }

  /**
   * @param {string} text
   * @param {NodeLike} node
   */
  updateText(text, node) {
    // @ts-ignore
    node.textContent = text;
    return node;
  }

  /**
   * @param {NodeLike} node
   */
  finalize(node) {
    return node;
  }

  /**
   * @param {NodeLike | NodeLike[]} [input]
   */
  createGroup(input) {
    const fragment = this.host.document.createDocumentFragment();
    if (input) {
      const children = Array.isArray(input) ? input : [input];
      for (const child of children) {
        connectNodes(fragment, child, this);
      }
    }
    return fragment;
  }

  /**
   * @param {any} group
   * @returns {NodeLike[]}
   */
  unwrapGroup(group) {
    return Array.from(group.childNodes);
  }

  /**
   * @param {string} tagname
   * @param {any} [props]
   */
  createContainer(tagname, props) {
    const defaultNamespace = props?.xmlns ?? 'http://www.w3.org/1999/xhtml';

    let ns;
    if (tagname === 'svg') {
      ns = 'http://www.w3.org/2000/svg';
    } else if (tagname === 'math') {
      ns = 'http://www.w3.org/1998/Math/MathML';
    } else {
      ns = defaultNamespace;
    }

    const element = /** @type {JsxElement} */ (
      this.host.document.createElementNS(ns, tagname)
    );
    element.__eventListenerList = new Map();
    element.__attributeCells = new Set();
    element.__createdByJsx = true;
    return element;
  }

  /**
   * @param {string | Cell<any>} text
   */
  createText(text) {
    if (Cell.isCell(text)) {
      const textNode = this.host.document.createTextNode(text.get());
      const { updateText } = this;
      addCellListener(
        textNode,
        text,
        function (value) {
          updateText(value, this);
        },
        false
      );
      return textNode;
    }

    return this.host.document.createTextNode(text);
  }

  /**
   * @param {NodeLike} node
   * @returns {node is FragmentLike}
   */
  isGroup(node) {
    return (
      node instanceof this.host.DocumentFragment &&
      !('__isShadowRootContainer' in node)
    );
  }

  /**
   * @param {any} child
   * @returns {child is NodeLike}
   */
  isNode(child) {
    return child instanceof this.host.Node;
  }
}
