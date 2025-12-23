import { getGlobalContext } from 'retend/context';
import {
  Cell,
  createScopeSnapshot,
  useSetupEffect,
  withScopeSnapshot,
  CellUpdateError,
  createNodesFromTemplate,
  __HMR_SYMBOLS,
} from 'retend';
import { routeToComponent } from 'retend/router';
import {
  addCellListener,
  removeCellListeners,
  copyCellListeners,
  createCommentPair,
  isMatchingCommentPair,
  consolidateNodes,
} from '../utils.js';

/** @import { ReactiveCellFunction } from '../utils.js' */
/** @import { __HMR_UpdatableFn, HmrContext } from 'retend'; */
/** @import { JSX } from 'retend/jsx-runtime'; */
/** @import { Scope } from 'retend' */
/** @import { DOMRenderer } from '../dom-renderer.js'; */

/** @typedef {Node & { __commentRangeSymbol?: symbol }} RangedNode */

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
 * @typedef {Node & {
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
  // if (import.meta.env.SSR) return; // Skip HMR on the server

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
  globalData.set(__HMR_SYMBOLS.HMRContextKey, context);
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
      const cell = oldInstance[__HMR_SYMBOLS.ComponentInvalidator];
      if (cell) {
        newInstance[__HMR_SYMBOLS.ComponentInvalidator] = cell;
        context.current.set(newInstance);
        cell.set(newInstance);
      }
    } catch (e) {
      if (e instanceof CellUpdateError) {
        for (const error of e.errors) errors.push(error);
      } else throw e;
    } finally {
      globalData.set(__HMR_SYMBOLS.HMRContextKey, null);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      // @ts-expect-error:
      console.error('HMR Update Error: ', error, error.__component);
    }
  }
}

/**
 *
 * @param {Scope & { [__HMR_SYMBOLS.HmrId]?: string }} Scope
 * @param {string} [fileName]
 */
function trackScopeReference(Scope, fileName) {
  const ScopeList = __HMR_SYMBOLS.ScopeList;
  if (!Reflect.get(Scope, __HMR_SYMBOLS.HmrId)) {
    const description = Scope.key.description;
    let uniqueId = description ? `${fileName}-${description}` : fileName;

    while (ScopeList.has(uniqueId)) uniqueId += '_';
    ScopeList.set(uniqueId, Scope);
    Reflect.set(Scope, __HMR_SYMBOLS.HmrId, uniqueId);
  }

  ScopeList.set(Scope[__HMR_SYMBOLS.HmrId], Scope);
  useSetupEffect(() => () => ScopeList.delete(Scope[__HMR_SYMBOLS.HmrId]));
}

/**
 * @param {__HMR_UpdatableFn} tagname
 * @param {any[]} props
 * @param {JSX.JSXDevFileData | undefined} fileData
 * @param {DOMRenderer} renderer
 */
export function withHMRBoundaries(tagname, props, fileData, renderer) {
  if (tagname.__isScopeProviderOf && fileData) {
    const { fileName } = fileData;
    const Scope = tagname.__isScopeProviderOf;
    if (!Reflect.get(Scope, __HMR_SYMBOLS.HmrId))
      trackScopeReference(Scope, fileName);
  }

  // In Dev mode and using HMR, components have a self-referential
  // Invalidator cell, which should automatically trigger a rerun of
  // the component.
  let invalidator = tagname[__HMR_SYMBOLS.ComponentInvalidator];
  if (!invalidator) {
    invalidator = Cell.source(tagname);
    tagname[__HMR_SYMBOLS.ComponentInvalidator] = invalidator;
  }
  return runInvalidatorWithHMRBoundaries(invalidator, props, renderer);
}

/**
 * @param {Node[]} nodes
 * @param {DOMRenderer} renderer
 */
function stabilizeNodes(nodes, renderer) {
  const { host: window } = renderer;
  // We can be smarter about whether or not to create a comment pair, so we
  // don't end up with a cluttered DOM tree.
  // NOTE TO FUTURE SELF: This optimization is only possible because
  // the comment ranges in other control flow structures already provide
  // guarantees about how nodes should behave.
  if (nodes.length === 0) return createCommentPair(renderer);

  if (nodes.length > 1 || '__promise' in nodes[0]) {
    const startNode = nodes[0];
    const endNode = nodes[nodes.length - 1];
    const isAlreadyStable =
      nodes.length > 1 &&
      startNode instanceof window.Comment &&
      endNode instanceof window.Comment &&
      isMatchingCommentPair(startNode, endNode);

    if (isAlreadyStable) return nodes;

    const pair = createCommentPair(renderer);
    return [pair[0], ...nodes, pair[1]];
  }

  return nodes;
}

/**
 * @param {Cell<__HMR_UpdatableFn>} value
 * @param {any[]} completeProps
 * @param {DOMRenderer} renderer
 */
export function runInvalidatorWithHMRBoundaries(
  value,
  completeProps,
  renderer
) {
  const snapshot = createScopeSnapshot();

  /** @returns {Node[]} */
  const nextComponentRender = () => {
    const ancestry = __HMR_SYMBOLS.useComponentAncestry();
    const template = __HMR_SYMBOLS.RetendComponentTree.Provider({
      // @ts-expect-error: if not, it recurses.
      h: false,
      value: [...ancestry, value.peek()],
      children: () => value.peek()(...completeProps, { createdByJsx: true }),
    });
    return stabilizeNodes(
      createNodesFromTemplate(template, renderer),
      renderer
    );
  };

  let nodes = withScopeSnapshot(snapshot, nextComponentRender);

  /** @type {ReactiveCellFunction<Function, Node, void>} */
  const refresh = function (fn) {
    snapshot.node.dispose();
    const swap = () => {
      const hmr = __HMR_SYMBOLS.getHMRContext();
      if (!hmr) return false;
      if (hmr.current.peek() === fn) {
        if (!this.isConnected) return false;
        // If a component render instance is in an update path, there is
        // no use updating it, since it will be (or has been) overwritten
        // by its parent.
        const parents = __HMR_SYMBOLS.useComponentAncestry();
        const instanceIsInUpdatePath = parents.some((c) => {
          return (c !== fn && hmr.old.includes(c)) || hmr.new.includes(c);
        });
        if (instanceIsInUpdatePath) return false;
      }

      if (this !== nodes[0]) {
        // Hard to explain, but it means at the leaf of the render tree
        // there was a single node, but a child component updated,
        // changing the value of that node.
        const staleNodes = nodes;
        nodes = [this];

        /** @type {Node | null} */
        let next = this;
        while (staleNodes.length !== nodes.length) {
          next = this.nextSibling;
          if (!next) break;
          nodes.push(next);
        }
      }

      const oldStart = nodes[0];
      const oldEnd = nodes[nodes.length - 1];

      nodes = nextComponentRender();
      const finalFragment = consolidateNodes(nodes, renderer);

      const range = window.document.createRange();
      range.setStartBefore(oldStart);
      range.setEndAfter(oldEnd);
      range.deleteContents();
      range.insertNode(finalFragment);

      queueMicrotask(() => {
        // We cannot start listening in this run of the event loop,
        // because then we are asking the system to overwrite what
        // we just replaced.
        copyCellListeners(this, nodes[0]);
        removeCellListeners(this); // prevents phantom updates.
      });
      return true;
    };
    const updated = withScopeSnapshot(snapshot, swap);
    if (updated) snapshot.node.activate();
  };

  addCellListener(nodes[0], value, refresh, false);
  return nodes;
}
