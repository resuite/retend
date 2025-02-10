import { Cell } from '@adbl/cells';
import {
  ArgumentList,
  createCommentPair,
  generateChildNodes,
  getMostCurrentFunction,
} from './utils.js';
import { linkNodesToComponent } from '../render/index.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * @template T
 * @typedef ForOptions
 * @property {T extends object ? keyof T : never} [key]
 * When iterating over objects with a predefined shape, this represents the property to use
 * as a caching index. By default a unique symbol will be used.
 */

/**
 * Creates a dynamic mapping of an iterable to DOM nodes, efficiently updating when the iterable changes.
 *
 * @template {Iterable<any>} U
 * @template [V=U extends Iterable<infer V> ? V : never]
 * @param {Cell<U> | U} list - The iterable or Cell containing an iterable to map over
 * @param {((item: V, index: Cell<number>, iter: U) => JSX.Template)} fn - Function to create a Template for each item
 * @param {ForOptions<V>} [options]
 * @returns {JSX.Template} - A Template representing the mapped items
 *
 * @example
 * // Create a reactive list of names
 * const names = Cell.source(['Alice', 'Bob', 'Charlie']);
 *
 * // Use For to create a dynamic list of <li> elements
 * const listItems = For(names, (name, index) => {
 *   const li = document.createElement('li');
 *   li.textContent = `${index.value + 1}. ${name}`;
 *   return li;
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
export function For(list, fn, options) {
  /*** @type {Node[]} */
  let snapshot = [];

  if (!Cell.isCell(list)) {
    let index = 0;
    for (const item of list) {
      /** @type {[any, Cell<number>, typeof list]} */
      const parameters = [item, Cell.source(index), list];
      const func = getMostCurrentFunction(fn);
      const nodes = generateChildNodes(func(...parameters));
      linkNodesToComponent(nodes, func, new ArgumentList(parameters));
      snapshot.push(...nodes);
      index += 1;
    }
    return snapshot;
  }

  const [rangeStart, rangeEnd] = createCommentPair();
  const uniqueItemMarker = options?.key ?? Symbol();

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

  /**
   * @type {Map<any, { index: Cell<number>,  nodes: Node[] }>}
   */
  let nodeStore = new Map();

  /**
   * @param {U} _list
   */
  const callback = (_list) => {
    /**
     * @type Node[]
     */
    const newSnapShot = [];
    const newNodeStore = new Map();

    let index = 0;
    for (const item of _list) {
      const itemKey = retrieveOrSetItemKey(item, index);
      const cachedResult = nodeStore.get(itemKey);
      if (cachedResult === undefined) {
        const i = Cell.source(index);
        /** @type {[any, Cell<number>, typeof list]} */
        const parameters = [item, i, list];
        const func = getMostCurrentFunction(fn);
        const nodes = generateChildNodes(func(...parameters));
        linkNodesToComponent(nodes, func, new ArgumentList(parameters));
        newNodeStore.set(itemKey, { nodes, index: i });
        newSnapShot.push(...nodes);
      } else {
        /** @type {import('@adbl/cells').SourceCell<number>} */
        (cachedResult.index).value = index;
        newNodeStore.set(itemKey, cachedResult);
        newSnapShot.push(...cachedResult.nodes);
      }
      index++;
    }

    nodeStore = newNodeStore;

    /** @type {ChildNode} */
    let currentNode = rangeStart;
    let oldIndex = 0;
    let newIndex = 0;

    while (
      newIndex < newSnapShot.length ||
      (currentNode.nextSibling && currentNode.nextSibling !== rangeEnd)
    ) {
      const newNode = /** @type {ChildNode} */ (newSnapShot[newIndex]);
      let oldNode = currentNode.nextSibling;

      if (!oldNode || oldNode === rangeEnd) {
        // Append remaining new nodes
        currentNode.after(...newSnapShot.slice(newIndex));
        break;
      }

      if (newIndex >= newSnapShot.length) {
        // Remove remaining old nodes
        while (oldNode && oldNode !== rangeEnd) {
          /** @type {ChildNode | null} */
          const nextOldNode = oldNode.nextSibling;
          oldNode.remove();
          oldNode = nextOldNode;
        }
        break;
      }

      if (oldNode === newNode) {
        // Node hasn't changed, move to next
        currentNode = oldNode;
        newIndex++;
        oldIndex++;
      } else {
        // Check if the new node exists later in the old list
        let futureOldNode = oldNode.nextSibling;
        let foundMatch = false;
        while (futureOldNode && futureOldNode !== rangeEnd) {
          if (futureOldNode === newNode) {
            // Remove skipped old nodes
            while (oldNode && oldNode !== futureOldNode) {
              const nextOldNode = /** @type {ChildNode} */ (
                oldNode.nextSibling
              );
              oldNode?.remove();
              oldNode = nextOldNode;
            }
            currentNode = futureOldNode;
            newIndex++;
            oldIndex = newIndex;
            foundMatch = true;
            break;
          }
          futureOldNode = futureOldNode.nextSibling;
        }

        if (!foundMatch) {
          // Insert new node
          oldNode.before(newNode);
          currentNode = newNode;
          newIndex++;
        }
      }
    }

    snapshot = newSnapShot;
  };

  // Prevents premature garbage collection.
  const persistedSet = new Set();
  persistedSet.add(list);
  persistedSet.add(callback);
  Reflect.set(rangeStart, '__attributeCells', persistedSet);

  list.runAndListen(callback, { weak: true });
  return [rangeStart, ...snapshot, rangeEnd];
}
