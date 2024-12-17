import { Cell } from '@adbl/cells';
import { ArgumentList, generateChildNodes } from './utils.js';
import { linkNodesToComponent } from '../render/index.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * Creates a dynamic mapping of an iterable to DOM nodes, efficiently updating when the iterable changes.
 *
 * @template {Iterable<any>} U
 * @param {Cell<U> | U} list - The iterable or Cell containing an iterable to map over
 * @param {(item: U extends Iterable<infer V> ? V : never, index: Cell<number>, iter: U) => JSX.Template} fn - Function to create a Template for each item
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
export function For(list, fn) {
  /**
   * @type {Node[]}
   */
  let snapshot = [];

  if (!Cell.isCell(list)) {
    let index = 0;
    for (const item of list) {
      /** @type {[any, Cell<number>, typeof list]} */
      const parameters = [item, Cell.source(index), list];
      const nodes = generateChildNodes(fn(...parameters));
      linkNodesToComponent(nodes, fn, new ArgumentList(parameters));
      snapshot.push(...nodes);
      index += 1;
    }
    return snapshot;
  }

  const rangeStart = globalThis.window.document.createComment('----');
  const rangeEnd = globalThis.window.document.createComment('----');
  const uniqueSymbolMarker = Symbol();
  /**
   * @type {Map<any, {
   *  index: Cell<number>,
   *  nodes: Node[]
   * }>}
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
      let itemKey;
      /**
       * @type {any}
       */
      const itemAsAny = item;
      const itemIsObjectLike =
        itemAsAny && /^(object|function|symbol)$/.test(typeof itemAsAny);

      if (itemIsObjectLike) {
        itemKey = itemAsAny[uniqueSymbolMarker];
      } else {
        itemKey = item?.toString ? `${item.toString()}.${index}` : index;
      }

      if (itemKey === undefined) {
        itemKey = Symbol();
        itemAsAny[uniqueSymbolMarker] = itemKey;
      }

      const cachedResult = nodeStore.get(itemKey);
      if (cachedResult === undefined) {
        const i = Cell.source(index);
        /** @type {[any, Cell<number>, typeof _list]} */
        const parameters = [item, i, _list];
        const nodes = generateChildNodes(fn(...parameters));
        linkNodesToComponent(nodes, fn, new ArgumentList(parameters));
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
