/** @import { ReconcilerOptions, Renderer } from "retend" */
/** @import { DOMRenderer } from './dom-renderer.js'; */
import { Cell, linkNodes, normalizeJsxChild, SourceCell } from 'retend';
import {
  addCellListener,
  createCommentPair,
  setAttribute,
  writeStaticStyle,
} from './utils.js';

/**
 * @param {Array<any>} segment
 * @param {ReconcilerOptions<any>} options
 * @param {Renderer<any>} renderer
 */
export function reconcile(segment, options, renderer) {
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
      node.remove();
    }
  }

  let lastInserted = segment[0];

  // Reordering and Inserting New Nodes:
  //
  // This pass ensures nodes are in the correct order and new nodes are inserted.
  // It compares each node's current position with the expected position after lastInserted,
  // moving nodes only when necessary to maintain the correct sequence.
  let i = 0;
  const batchAdd = renderer.host.document.createDocumentFragment();
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
 * @param {any} node
 * @param {string} key
 * @param {any} value
 * @param {(el: any, key: string, value: any) => void} [setEventListener]
 */
export function setProperty(node, key, value, setEventListener) {
  // Special Internal Key:
  // Links a VNode to the array that holds it.
  if (key === 'retend:collection') {
    // We assume the VNode implementation allows arbitrary property assignment
    // or we use a weakmap if we want to be stricter.
    // Since we are likely in VDOM mode if this is relevant:
    Reflect.set(node, '__retend_collection_ref', value);
    return node;
  }

  if (key === 'children') {
    return node;
  }
  const element = node;
  if (Cell.isCell(value)) {
    if (!element.__attributeCells) element.__attributeCells = new Set();
    if (key === 'ref' && value instanceof SourceCell) {
      value.set(element);
      element.__ref = value;
      element.__attributeCells.add(value);
      return node;
    }
    addCellListener(element, value, function (value) {
      if (value instanceof Promise) {
        value.then((resolvedValue) => {
          setAttribute(this, key, resolvedValue, setEventListener);
        });
      } else setAttribute(this, key, value, setEventListener);
    });
  } else setAttribute(element, key, value, setEventListener);

  return node;
}

/**
 * @param {Promise<any>} child
 * @param {Renderer<any>} renderer
 */
export function handlePromise(child, renderer) {
  const placeholder = renderer.host.document.createComment('----');
  Reflect.set(placeholder, '__promise', child);
  child.then((value) => {
    placeholder.replaceWith(normalizeJsxChild(value, renderer));
  });
  return placeholder;
}

/**
 * @param {any} input
 * @param {Renderer<any>} renderer
 */
export function createGroup(input, renderer) {
  const fragment = renderer.host.document.createDocumentFragment();
  if (input) {
    const children = Array.isArray(input) ? input : [input];
    for (const child of children) {
      linkNodes(fragment, child, renderer);
    }
  }
  return fragment;
}

/**
 * @param {any} fragment
 * @param {Renderer<any>} renderer
 * @returns {any}
 */
export function createGroupHandle(fragment, renderer) {
  // @ts-expect-error
  const handle = createCommentPair(renderer);
  fragment.replaceChildren(handle[0], ...fragment.childNodes, handle[1]);
  return handle;
}

/**
 * @param {any} segment
 * @param {any[]} newContent
 */
export function write(segment, newContent) {
  const start = segment[0];
  const end = segment[1];

  let nextNode = start.nextSibling;
  while (nextNode && nextNode !== end) {
    nextNode.remove();
    nextNode = start.nextSibling;
  }
  start.after(...newContent);
}

/**
 * @param {string} text
 * @param {any} node
 */
export function updateText(text, node) {
  node.textContent = String(text);
  return node;
}

/**
 * @param {string | Cell<any>} text
 * @param {Renderer<any>} renderer
 */
export function createText(text, renderer) {
  if (Cell.isCell(text)) {
    const textNode = renderer.host.document.createTextNode(String(text.get()));
    const { updateText } = renderer;
    /**
     * @this any
     * @param {any} value
     */
    function updateTextValue(value) {
      if (value instanceof Promise) {
        value.then((resolvedValue) => updateText(resolvedValue, this));
      } else updateText(value, this);
    }
    addCellListener(textNode, text, updateTextValue, false);
    return textNode;
  }

  return renderer.host.document.createTextNode(String(text));
}

/**
 * @param {DOMRenderer} renderer
 */
export function writeStaticStyles(renderer) {
  writeStaticStyle(
    'dom-styles',
    ':where(retend-outlet, retend-teleport) { display: contents }' +
      ':where(retend-unique-instance) {display: block;width:fit-content;height:fit-content}',
    renderer
  );
}

/**
 * @param {any} node
 * @param {any} data
 * @param {Renderer<any>} renderer
 */
export function saveContainerState(node, data, renderer) {
  if (!(node instanceof renderer.host.Element)) {
    throw new Error('Cannot save state of non-element node.');
  }
  return {
    childNodes: [...node.childNodes],
    shadowRoot: node.shadowRoot,
    data,
  };
}

/**
 * @param {any} node
 * @param {any} data
 * @param {Renderer<any>} renderer
 */
export function restoreContainerState(node, data, renderer) {
  renderer.append(node, data.childNodes);
  if (data.shadowRoot) {
    const { mode, childNodes } = data.shadowRoot;
    const newShadow = node.attachShadow({ mode });
    renderer.append(newShadow, [...childNodes]);
  }
}

/**
 * @param {any} parentNode
 * @param {any | any[]} childNode
 * @param {Renderer<any>} renderer
 */
export function appendShadowRoot(parentNode, childNode, renderer) {
  if (childNode instanceof ShadowRootFragment) {
    if (!(parentNode instanceof renderer.host.HTMLElement)) {
      console.error('ShadowRoot can only be children of HTML Elements.');
      return parentNode;
    }

    const shadowRoot =
      parentNode.shadowRoot ?? parentNode.attachShadow({ mode: 'open' });
    linkNodes(shadowRoot, childNode.props.children, renderer);
    return parentNode;
  }
}

export class ShadowRootFragment {
  /** @param {any} props */
  constructor(props) {
    this.props = props ?? {};
  }
}

export { containerIsDynamic } from './utils.js';
