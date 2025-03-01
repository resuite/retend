import { Cell } from '@adbl/cells';
import {
  addCellListener,
  ArgumentList,
  createCommentPair,
  generateChildNodes,
  getMostCurrentFunction,
} from './utils.js';
import { linkNodesToComponent } from '../render/index.js';
import { getGlobalContext, matchContext, Modes } from './context.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */
// @ts-ignore: Deno has issues with @import tags.
/** @import * as VDom from '../v-dom/index.js' */
// @ts-ignore: Deno has issues with @import tags.
/** @import {ReactiveCellFunction} from './utils.js' */

/** @typedef {VDom.VNode | ChildNode} ChildNodeLike */

/**
 * @template T
 * @typedef ForOptions
 * @property {T extends object ? keyof T : never} [key]
 * When iterating over objects with a predefined shape, this represents the property to use
 * as a caching index. By default a unique symbol will be used, resulting in a mutation of the object.
 * @property {(node: ChildNodeLike[]) => void} [onBeforeNodesMove]
 * Provides access to a node just before it is moved to a new position in the DOM by any of the
 * items in the list.
 * @property {(node: ChildNodeLike, fromIndex: number) => void} [onBeforeNodeRemove]
 * Provides access to a node just before it is removed from the DOM by any of the
 * items in the list.
 */

/**
 * Creates a dynamic, efficient mapping of an iterable to DOM nodes that automatically updates when the iterable changes.
 * Supports both static and reactive lists, with optimized DOM operations for minimal reflows.
 *
 * @template V
 * @template {V extends Cell<infer S> ? S extends Iterable<infer T> ? T: never: V extends Iterable<infer U>? U: never} W
 * @param {V} list - The iterable or Cell containing an iterable to map over
 * @param {((item: W, index: Cell<number>, iter: V) => JSX.Template)} fn - Function to create a Template for each item
 * @param {ForOptions<V extends Cell<infer S> ? S extends Iterable<infer T> ? T: never: V extends Iterable<infer U>? U: never>} [options]
 * @returns {JSX.Template} - A Template representing the mapped items
 *
 * @example
 * // Create a reactive list of names
 * const names = Cell.source(['Alice', 'Bob', 'Charlie']);
 *
 * // Use For to create a dynamic list of <li> elements
 * const listItems = For(names, (name, index) => {
 *  return <li>{name} at index {index}</li>;
 * });
 *
 * // Append the list items to a <ul> element
 * const ul = document.createElement('ul');
 * ul.append(...listItems);
 * document.body.appendChild(ul);
 *
 * // Later, update the names
 * names.value.push('David');
 * // The list will automatically update to include the new name
 */
// TODO: Make object mutation safe or optional.
export function For(list, fn, options) {
  /*** @type {(Node | VDom.VNode)[]} */
  const initialSnapshot = [];
  const func = getMostCurrentFunction(fn);
  const { window } = getGlobalContext();
  const { onBeforeNodesMove, onBeforeNodeRemove, key } = options ?? {};

  // -----------------------------------------------
  // STATIC LISTS
  // -----------------------------------------------
  if (!Cell.isCell(list)) {
    let i = 0;
    // @ts-ignore: The list as a whole is very hard to type properly.
    for (const item of list) {
      const parameters = [item, Cell.source(i), list];
      const nodes = generateChildNodes(func(...parameters));
      linkNodesToComponent(nodes, func, new ArgumentList(parameters));
      initialSnapshot.push(...nodes);
      i++;
    }
    return initialSnapshot;
  }

  // -----------------------------------------------
  // REACTIVE LISTS
  // -----------------------------------------------
  /** @type {Map<any, { index: Cell<number>,  nodes: ChildNodeLike[] }>} */
  let cacheFromLastRun = new Map();
  const uniqueItemMarker = key ?? Symbol();
  const [listStart, listEnd] = createCommentPair();

  /**
   * @param {any} item
   * @param {number} i
   */
  const retrieveOrSetItemKey = (item, i) => {
    let itemKey;
    const isObject = item && /^(object|function|symbol)$/.test(typeof item);
    if (isObject) itemKey = item[uniqueItemMarker];
    else itemKey = item?.toString ? `${item.toString()}.${i}` : i;

    if (itemKey === undefined) {
      itemKey = Symbol();
      item[uniqueItemMarker] = itemKey;
    }
    return itemKey;
  };

  let isRunningInVDom = matchContext(window, Modes.VDom);
  /** @param {any[]} nodes */
  const addHydrationUpgradeListeners = (nodes) => {
    if (!isRunningInVDom) return;
    // Allows the hydration process to hook into the caching behavior of
    // the For function and update the nodes directly in the cached array.
    /** @param {VDom.HydrationUpgradeEvent} event */
    const hydrationUpgradeCallback = (event) => {
      const target = /** @type {VDom.VNode} */ (event.target);
      const domNode = event.detail.newInstance;
      nodes.splice(nodes.indexOf(target), 1, domNode);
    };

    for (const node of nodes) {
      node.addEventListener('hydrationupgrade', hydrationUpgradeCallback, {
        once: true,
      });
    }
  };

  // First run, prior to any changes.
  let i = 0;

  for (const item of list.value) {
    const index = Cell.source(i);
    const parameters = [item, index, list];
    const template = func(...parameters);
    const nodes = /** @type {ChildNodeLike[]} */ (generateChildNodes(template));
    linkNodesToComponent(nodes, func, new ArgumentList(parameters));
    addHydrationUpgradeListeners(nodes);
    initialSnapshot.push(...nodes);
    const itemKey = retrieveOrSetItemKey(item, i);
    cacheFromLastRun.set(itemKey, { index, nodes });
    i++;
  }

  /** @type {ReactiveCellFunction<any, ChildNodeLike | VDom.VComment>} */
  const reactToListChanges = function (newList) {
    const { window } = getGlobalContext();
    isRunningInVDom = matchContext(window, Modes.VDom);
    const newCache = new Map();
    /** @type {Map<ChildNodeLike, { itemKey: any, lastItemLastNode: ChildNodeLike | null }>} */
    const nodeLookAhead = new Map();
    const func = getMostCurrentFunction(fn);

    let index = 0;
    let lastItemLastNode = null;
    for (const item of newList) {
      const itemKey = retrieveOrSetItemKey(item, index);
      const cachedResult = cacheFromLastRun.get(itemKey);
      let firstNode = null;
      let lastNode = null;
      if (cachedResult === undefined) {
        const i = Cell.source(index);
        const parameters = [item, i, list];
        const newTemplate = func(...parameters);
        const nodes = /** @type {ChildNodeLike[]} */ (
          generateChildNodes(newTemplate)
        );
        addHydrationUpgradeListeners(nodes);
        linkNodesToComponent(nodes, func, new ArgumentList(parameters));
        newCache.set(itemKey, { nodes, index: i });
        firstNode = nodes[0];
        lastNode = nodes[nodes.length - 1];
      } else {
        /** @type {import('@adbl/cells').SourceCell<number>} */
        (cachedResult.index).value = index;
        newCache.set(itemKey, cachedResult);
        const nodes = cachedResult.nodes;
        firstNode = nodes[0];
        lastNode = nodes[nodes.length - 1];
      }
      if (firstNode)
        nodeLookAhead.set(firstNode, { itemKey, lastItemLastNode });
      lastItemLastNode = lastNode;
      index++;
    }

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
      // There was a previous optimization to try and remove contiguous nodes
      // at once with range.deleteContents(), but it was not worth it.
      for (const node of value.nodes) {
        onBeforeNodeRemove?.(node, value.index.value);
        node.remove();
      }
    }

    /** @type {ChildNodeLike | VDom.VComment} */
    let lastInserted = this;

    // Reordering and Inserting New Nodes:
    //
    // This pass ensures nodes are in the correct order and new nodes are inserted.
    // It compares each node's current position with the expected position after lastInserted,
    // moving nodes only when necessary to maintain the correct sequence.
    let i = 0;
    const batchAdd = window.document.createDocumentFragment();
    const batchAddLike = /** @type {*} */ (batchAdd);
    for (const item of newList) {
      /** @type {{ nodes: ChildNodeLike[] }} */ // Invariant: nodes is always defined.
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
            const fullNodeSet = newCache.get(itemKey).nodes;
            onBeforeNodesMove?.(nodes);
            lastItemLastNode.after(...fullNodeSet);

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
        onBeforeNodesMove?.(nodes);
        lastInserted.after(.../** @type {*} */ (nodes));
      } else {
        const newPtr = /** @type {ChildNodeLike} */ (batchAdd.lastChild);
        lastInserted.after(batchAddLike);
        onBeforeNodesMove?.(nodes);
        newPtr.after(.../** @type {*} */ (nodes));
      }
      lastInserted = nodes[nodes.length - 1] ?? lastInserted;
      i++;
    }

    if (batchAdd.childNodes.length) lastInserted.after(batchAddLike);
    cacheFromLastRun = newCache;
  };

  addCellListener(listStart, list, reactToListChanges, false);
  return [listStart, ...initialSnapshot, listEnd];
}
