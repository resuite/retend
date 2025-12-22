/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { ScopeSnapshot } from './scope.js' */

import { Cell } from '@adbl/cells';
import { h } from './jsx.js';
import { ArgumentList } from './utils.js';
import { createScopeSnapshot, withScopeSnapshot } from './scope.js';
import { getActiveRenderer } from './renderer.js';
import { IgnoredHProps } from '../_internals.js';

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

 * const ul = document.createElement('ul');
 * ul.append(...listItems);
 * document.body.appendChild(ul);
 *
 * // Later, update the names
 * names.get().push('David');
 * // The list will automatically update to include the new name
 */
export function For(list, fn, options) {
  const renderer = getActiveRenderer();

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
      const nodes = h(
        fn,
        new ArgumentList([item, Cell.source(i), list]),
        ...IgnoredHProps,
        renderer
      );
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
  /** @type {Map<any, { index: Cell<number>,  nodes: unknown[], snapshot: ScopeSnapshot }>} */
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
   * @param {V & {[Symbol.iterator]: () => Iterator<V>}} listValue
   */
  const reactToListChanges = (listValue) => {
    const newList =
      typeof listValue?.[Symbol.iterator] === 'function' ? listValue : [];
    const newCache = new Map();
    const effectNodesToActivate = [];
    /** @type {Map<unknown, { itemKey: any, lastItemLastNode: unknown | null }>} */
    const nodeLookAhead = new Map();

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
        /** @type {ScopeSnapshot} */
        const snapshot = {
          scopes: base.scopes,
          node: base.node.branch(),
        };
        const newNodes = withScopeSnapshot(snapshot, () => {
          return h(
            fn,
            new ArgumentList(parameters),
            ...IgnoredHProps,
            renderer
          );
        });
        effectNodesToActivate.push(snapshot.node);
        const nodes = Array.isArray(newNodes) ? newNodes : [newNodes];
        trackNodes(nodes);
        newCache.set(itemKey, { nodes, index: i, snapshot });
        firstNode = nodes[0];
        lastNode = nodes[nodes.length - 1];
      } else {
        /** @type {import('@adbl/cells').SourceCell<number>} */
        (cachedResult.index).set(index);
        newCache.set(itemKey, cachedResult);
        const nodes = cachedResult.nodes;
        firstNode = nodes[0];
        lastNode = nodes[nodes.length - 1];
      }
      if (firstNode) {
        nodeLookAhead.set(firstNode, { itemKey, lastItemLastNode });
      }
      lastItemLastNode = lastNode;
      index++;
    }

    const reconciliationOptions = {
      cacheFromLastRun,
      onBeforeNodeRemove,
      onBeforeNodesMove,
      retrieveOrSetItemKey,
      newCache,
      newList,
      nodeLookAhead,
    };
    renderer.reconcile(handle, reconciliationOptions);

    cacheFromLastRun = newCache;
    for (const node of effectNodesToActivate) node.activate();
  };

  list.listen(reactToListChanges);

  /** @type {ReturnType<typeof renderer.createGroupHandle>} */
  let handle;
  /** @type {ReturnType<typeof renderer.createGroup>} */
  let group;
  // First run, prior to any changes.
  let i = 0;
  // We get a snapshot of all current scopes to reuse when new
  // component instances are created.
  const base = createScopeSnapshot();
  const _list = list.get();
  if (
    _list !== null &&
    _list !== undefined &&
    _list[Symbol.iterator] !== undefined
  ) {
    const allNodes = [];
    for (const item of _list) {
      const index = Cell.source(i);
      const parameters = [item, index, list];
      // We have to split the snapshot so that each For item render
      // can have its own effect context without polluting the others.
      /** @type {ScopeSnapshot} */
      const snapshot = {
        scopes: base.scopes,
        node: base.node.branch(),
      };
      const newNodes = withScopeSnapshot(snapshot, () =>
        h(fn, new ArgumentList(parameters), ...IgnoredHProps, renderer)
      );
      const nodes = Array.isArray(newNodes) ? newNodes : [newNodes];
      trackNodes(nodes);
      allNodes.push(...nodes);

      const itemKey = retrieveOrSetItemKey(item, i);
      cacheFromLastRun.set(itemKey, { index, nodes, snapshot });
      i++;
    }
    group = renderer.createGroup(allNodes);
    handle = renderer.createGroupHandle(group);
  } else {
    group = renderer.createGroup([]);
    handle = renderer.createGroupHandle(group);
  }
  return group;
}
