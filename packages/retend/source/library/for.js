/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { StateSnapshot } from './scope.js' */

import { Cell, AsyncCell } from '@adbl/cells';

import { useAwait } from './await.js';
import { getActiveRenderer } from './renderer.js';
import { branchState, withState } from './scope.js';

/**
 * @template {import('./renderer.js').RendererTypes} Types
 * @param {unknown} value
 * @param {import('./renderer.js').Renderer<Types>} renderer
 * @returns {unknown[]}
 */
function flattenNodes(value, renderer) {
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value) {
      if (renderer.isGroup(item)) {
        result.push(...renderer.unwrapGroup(item));
      } else {
        result.push(item);
      }
    }
    return result;
  }
  if (renderer.isGroup(value)) {
    return [...renderer.unwrapGroup(value)];
  }
  return [value];
}

/**
 * Extracts the item type from a list value.
 * Handles AsyncCell<Promise<Iterable<T>>>, Cell<Iterable<T>>, and Iterable<T>.
 * @template V
 * @typedef {V extends AsyncCell<infer P>
 *   ? Awaited<P> extends Iterable<infer T> ? T : never
 *   : V extends Cell<infer S>
 *     ? S extends Iterable<infer T> ? T : never
 *     : V extends Iterable<infer U> ? U : never} ExtractItemType
 */

/**
 * @template T
 * @typedef ForOptions
 * @property {(T extends object ? keyof T : never) | ((item: T) => PropertyKey)} [key]
 * Specifies how to generate a unique key for each item to enable efficient caching and updates.
 * Can be a property name of the item object or a function that returns a key based on the item.
 *
 * By default, a unique symbol is used for objects, or the item itself for primitives.
 * @property {(node: unknown[]) => void} [onBeforeNodesMove]
 * Provides access to a node just before it is moved to a new position by any of the
 * items in the list.
 * @property {(node: unknown, fromIndex: number) => void} [onBeforeNodeRemove]
 * Provides access to a node just before it is removed by any of the
 * items in the list.
 */

/**
 * Creates a dynamic, efficient mapping of an iterable that automatically updates when the iterable changes.
 * Supports both static and reactive lists, with optimized operations for minimal reflows.
 *
 * @template V
 * @template {ExtractItemType<V>} W
 * @param {V} list - The iterable or Cell containing an iterable to map over
 * @param {((item: W, index: Cell<number>, iter: V) => JSX.Template)} fn - Function to create a Template for each item
 * @param {ForOptions<W>} [options]
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

 * const ul = document.createElement('ul');
 * ul.append(...renderer.render(listItems));
 * document.body.appendChild(ul);
 *
 * // Later, update the names
 * names.get().push('David');
 * // The list will automatically update to include the new name
 */
export function For(list, fn, options) {
  return () => {
    const renderer = getActiveRenderer();
    if (!fn.name) Object.defineProperty(fn, 'name', { value: 'For.Item' });

    // -----------------------------------------------
    // STATIC LISTS
    // -----------------------------------------------
    if (!Cell.isCell(list)) {
      /** @type {*} */
      const initialResult = [];
      let i = 0;
      // @ts-ignore: The list as a whole is very hard to type properly.
      if (typeof list?.[Symbol.iterator] !== 'function') {
        return initialResult;
      }
      // @ts-ignore: The list as a whole is very hard to type properly.
      for (const item of list) {
        const nodes = renderer.handleComponent(fn, [
          item,
          Cell.source(i),
          list,
        ]);
        if (Array.isArray(nodes)) {
          initialResult.push(...nodes);
        } else {
          initialResult.push(nodes);
        }
        i++;
      }
      return initialResult;
    }

    // -----------------------------------------------
    // REACTIVE LISTS
    // -----------------------------------------------
    const { key, onBeforeNodeRemove, onBeforeNodesMove } = options ?? {};
    /** @type {Map<any, { index: Cell<number>,  nodes: unknown[], snapshot: StateSnapshot }>} */
    let cacheFromLastRun = new Map();
    const autoKeys = new WeakMap();

    /**
     * @param {any} item
     * @param {number} i
     */
    const retrieveOrSetItemKey = (item, i) => {
      let itemKey;
      const isObject = item && /^(object|function|symbol)$/.test(typeof item);
      if (isObject) {
        itemKey =
          key !== undefined
            ? typeof key === 'function'
              ? key(item)
              : item[key]
            : autoKeys.get(item);
        if (key === undefined && itemKey === undefined) {
          // auto memo only when no key option is defined.
          itemKey = Symbol();
          autoKeys.set(item, itemKey);
        }
      } else itemKey = item?.toString ? `${item.toString()}.${i}` : i;

      return itemKey;
    };

    /** @param {unknown[]} nodes */
    const trackNodes = (nodes) => {
      for (const node of nodes) {
        // "Bind" the node to this array.
        // If the node's identity changes (e.g. hydration), the system
        // is responsible for updating the array.
        renderer.setProperty(node, 'retend:collection', nodes);
      }
    };

    /**
     * @param {V & {[Symbol.iterator]: () => Iterator<V>} | Promise<any>} listValue
     */
    const reactToListChanges = (listValue) => {
      if (listValue instanceof Promise) listValue.then(processListChanges);
      else processListChanges(listValue);
    };

    /**
     * @param {any} listValue
     * @param {boolean} [initial]
     */
    const processListChanges = (listValue, initial = false) => {
      const newList =
        typeof listValue?.[Symbol.iterator] === 'function' ? listValue : [];
      const newCache = new Map();
      const effectNodesToActivate = [];
      const initialNodes = [];
      /** @type {Map<unknown, { itemKey: any, lastItemLastNode: unknown | null }>} */
      const nodeLookAhead = new Map();

      let index = 0;
      let lastItemLastNode = null;
      for (const item of newList) {
        const itemKey = retrieveOrSetItemKey(item, index);
        let result = cacheFromLastRun.get(itemKey);
        if (result === undefined) {
          const itemIndex = Cell.source(index);
          const parameters = [item, itemIndex, list];
          /** @type {StateSnapshot} */
          const snapshot = {
            scopes: base.scopes,
            node: base.node.branch(),
            renderer: base.renderer,
            data: base.data,
          };
          const nodes = flattenNodes(
            withState(snapshot, () =>
              renderer.handleComponent(fn, parameters, snapshot)
            ),
            renderer
          );
          trackNodes(nodes);
          result = { nodes, index: itemIndex, snapshot };
          if (!initial) effectNodesToActivate.push(snapshot.node);
        } else {
          /** @type {import('@adbl/cells').SourceCell<number>} */
          (result.index).set(index);
        }
        newCache.set(itemKey, result);
        const { nodes } = result;
        if (initial) initialNodes.push(...nodes);
        else if (nodes[0]) {
          nodeLookAhead.set(nodes[0], { itemKey, lastItemLastNode });
        }
        lastItemLastNode = nodes[nodes.length - 1];
        index++;
      }

      if (initial) renderer.write(handle, initialNodes);
      else {
        renderer.reconcile(handle, {
          cacheFromLastRun,
          onBeforeNodeRemove,
          onBeforeNodesMove,
          retrieveOrSetItemKey,
          newCache,
          newList,
          nodeLookAhead,
        });
        renderer.observer?.flush();
      }

      cacheFromLastRun = newCache;
      for (const node of effectNodesToActivate) node.activate();
    };

    if (list instanceof AsyncCell) useAwait()?.waitUntil(list);
    list.listen(reactToListChanges);

    const group = renderer.createGroup();
    const handle = renderer.createGroupHandle(group);
    // We get a snapshot of all current scopes to reuse when new
    // component instances are created.
    const base = branchState();
    base.data = { handle };
    const initialList = list.get();

    if (initialList instanceof Promise) {
      initialList.then(reactToListChanges);
      return group;
    }

    processListChanges(initialList, true);
    return group;
  };
}
