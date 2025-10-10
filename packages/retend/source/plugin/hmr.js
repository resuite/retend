import { Cell } from '@adbl/cells';
import { getGlobalContext, matchContext, Modes } from '../context/index.js';
import { createScopeSnapshot, withScopeSnapshot } from '../library/scope.js';
import { routeToComponent } from '../router/routeTree.js';
import { CellUpdateError } from '@adbl/cells';
import {
  generateChildNodes,
  createCommentPair,
  addCellListener,
  consolidateNodes,
  removeCellListeners,
  copyCellListeners,
} from '../library/utils.js';
import { useComponentAncestry } from '../library/jsx.js';

/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import * as VDom from '../v-dom/index.js' */
/** @import { SourceCell } from '@adbl/cells' */
/** @import { ReactiveCellFunction } from '../library/utils.js' */

export const ComponentInvalidator = Symbol('Invalidator');
export const HMRContext = Symbol('HMRContext');

/** @typedef {{ __nextInstance?: (...args: any[]) => JSX.Template, [ComponentInvalidator]?: Cell<Function & UpdatableFn> } & Function} UpdatableFn */
/** @typedef {Node & { __commentRangeSymbol?: symbol }} RangedNode */

/**
 * @typedef HmrContext
 * @property {Array<unknown>} old
 * @property {Array<unknown>} new
 * @property {SourceCell<Function | null>} current
 */

/**
 * @typedef Instance
 *
 * @property {Record<string, unknown>} [props]
 * Props passed to the component instance.
 *
 * @property {RangedNode[]} nodes
 * Nodes returned from the component instance.
 */

/**
 * @typedef {(Node | VDom.VNode) & {
 *  __linked?: boolean,
 *  __promise?: Promise<Node[]>
 * }} LinkableNodeLike
 */

/**
 * @typedef {Node & {
 *  __linked?: boolean,
 *  __promise?: Promise<Node[]>
 * }} LinkableNode
 */

/**
 * @typedef {Object} HMRFunctionOptions
 */

/**
 * Hot reload handler for JSX components, updating only changed functions within a module.
 * Compares instances of JSX function components between the old and new modules to selectively
 * re-render only those that have changed. This approach avoids unnecessary re-renders and
 * optimizes hot module replacement (HMR) for JSX files.
 *
 * @param {Object} newModule - The updated module with potentially changed function components.
 * @param {string} url - The module's URL, used to dynamically import and compare the old module.
 */
export async function hotReloadModule(newModule, url) {
  if (import.meta.env.SSR) return; // Skip HMR on the server

  if (!newModule) return;

  // Dynamically import the old module using its URL.
  const oldModule = await import(/* @vite-ignore */ url);

  const newModuleData = Object.entries(newModule);
  if (newModuleData.length === 0) {
    globalThis.window?.location?.reload?.();
    return;
  }

  const { globalData } = getGlobalContext();
  const errors = [];
  /** @type {HmrContext} */
  const context = {
    current: Cell.source(/** @type {Function | null} */ (null)),
    old: Object.values(oldModule),
    new: Object.values(newModule),
  };
  globalData.set(HMRContext, context);
  for (const [key, newInstance] of newModuleData) {
    const oldInstance = oldModule[key];
    if (!oldInstance) continue;
    if (typeof oldInstance !== 'function') continue;
    if (typeof newInstance !== 'function') continue;

    // If the function is a routing component, then it needs to swapped out
    // in the route tree.
    if (routeToComponent.has(oldInstance)) {
      const matches = routeToComponent.get(oldInstance);
      if (matches) {
        for (const match of matches) {
          match.component = newInstance;
        }
        routeToComponent.set(newInstance, matches);
      }
      routeToComponent.delete(oldInstance);
    }

    try {
      const cell = oldInstance[ComponentInvalidator];
      if (cell) {
        newInstance[ComponentInvalidator] = cell;
        context.current.set(newInstance);
        cell.set(newInstance);
      }
    } catch (e) {
      if (e instanceof CellUpdateError) errors.push(...e.errors);
      else {
        globalData.set(HMRContext, null);
        throw e;
      }
    }
  }
  globalData.set(HMRContext, null);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    throw new Error('Errors encountered during HMR update');
  }
}

/** @returns {HmrContext | null} */
export function getHMRContext() {
  const { globalData } = getGlobalContext();
  return globalData.get(HMRContext);
}

/**
 *
 * @param {Cell<UpdatableFn>} value
 * @param {(c: UpdatableFn) => JSX.Template} fn
 */
export function setupHMRBoundaries(value, fn) {
  const scopeSnapshot = createScopeSnapshot();

  // We can be smarter about whether or not to create a comment pair, so we
  // don't end up with a cluttered DOM tree.
  // NOTE TO FUTURE SELF: This optimization is only possible because
  // the comment ranges in other control flow structures already provide
  // guarantees about how nodes should behave.
  let nodes = withScopeSnapshot(scopeSnapshot, () => {
    return generateChildNodes(fn(value.peek()));
  });
  if (nodes.length === 0) nodes = createCommentPair();
  else if (nodes.some((node) => '__promise' in node)) {
    // async path: If any of the nodes generated are promise
    // placeholders, we cannot use it as a stable anchor.
    const pair = createCommentPair();
    nodes = [pair[0], ...nodes, pair[1]];
  }

  /** @type {ReactiveCellFunction<Function, Node | VDom.VNode, void>} */
  const callback = function (_value) {
    scopeSnapshot.node.dispose();
    const updated = withScopeSnapshot(scopeSnapshot, () => {
      const { window } = getGlobalContext();
      if (!matchContext(window, Modes.Interactive)) {
        const message = 'Cannot handle HMR in non-interactive environments';
        console.error(message);
        return;
      }
      const hmr = getHMRContext();
      if (!hmr) return;
      if (hmr.current.peek() === _value) {
        if (!this.isConnected) return false;

        // If a component render instance is in an update path, there is
        // no use updating it, since it will be (or has been) overwritten
        // by its parent.
        let parents;
        try {
          parents = useComponentAncestry();
        } catch {}
        const instanceIsInUpdatePath = parents?.some(
          (component) =>
            (component !== _value && hmr.old.includes(component)) ||
            hmr.new.includes(component)
        );
        if (instanceIsInUpdatePath) return false;
      }

      if (this !== nodes[0]) {
        // Hard to explain, but it means at the leaf of the render tree there was a single node,
        // but a child component updated, changing the value of that node.
        const staleNodes = nodes;
        nodes = [this];

        /** @type {Node | VDom.VNode | null} */
        let next = this;
        while (staleNodes.length !== nodes.length) {
          next = this.nextSibling;
          if (!next) break;
          nodes.push(next);
        }
      }

      const range = window.document.createRange();
      const start = /** @type {Node} */ (nodes[0]);
      const end = /** @type {Node} */ (nodes[nodes.length - 1]);
      range.setStartBefore(start);
      range.setEndAfter(end);
      range.deleteContents();

      // update outer nodes array.
      nodes = generateChildNodes(fn(_value));
      if (nodes.length === 0) nodes = createCommentPair();
      else if (nodes.some((node) => '__promise' in node)) {
        // async path: If any of the nodes generated are promise
        // placeholders, we cannot use it as a stable anchor.
        const pair = createCommentPair();
        nodes = [pair[0], ...nodes, pair[1]];
      }

      range.insertNode(/** @type {*} */ (consolidateNodes(nodes)));
      copyCellListeners(this, nodes[0]);
      removeCellListeners(this); // prevents phantom updates.
      return true;
    });
    if (updated) {
      scopeSnapshot.node.activate();
    }
  };

  addCellListener(nodes[0], value, callback, false);
  return nodes;
}
