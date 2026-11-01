import {
  Cell,
  CellUpdateError,
  __HMR_SYMBOLS,
  createNodesFromTemplate,
  branchState,
  withState,
} from 'retend';
import { getGlobalContext } from 'retend/context';
import { routeToComponent } from 'retend/router';

import {
  consolidateNodes,
  createCommentPair,
  isMatchingCommentPair,
} from '../utils.js';

/** @import { __HMR_UpdatableFn, HmrContext } from 'retend'; */
/** @import { JSX } from 'retend/jsx-runtime'; */
/** @import { DOMRenderer } from '../dom-renderer.js'; */

/**
 * Hot reload handler for JSX components, updating only changed functions within a module.
 * Compares instances of JSX function components between the old and new modules to selectively
 * re-render only those that have changed. This approach avoids unnecessary re-renders and
 * optimizes hot module replacement (HMR) for JSX files.
 *
 * @param {Record<string, unknown>} newModule - The updated module with potentially changed function components.
 * @param {Record<string, unknown> | undefined} oldModule - The previous module exports.
 */
export async function hotReloadModule(newModule, oldModule) {
  // if (import.meta.env.SSR) return; // Skip HMR on the server

  if (!newModule) return;
  if (!oldModule) return;

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
  // An update can be triggered from inside another update's render (a component
  // that mounts a module which is itself being replaced), so the context has to
  // be restored rather than cleared.
  const outerContext = globalData.get(__HMR_SYMBOLS.HMRContextKey);
  globalData.set(__HMR_SYMBOLS.HMRContextKey, context);
  try {
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
        const current = /** @type {any} */ (oldInstance);
        const next = /** @type {any} */ (newInstance);
        const cell = current[__HMR_SYMBOLS.ComponentInvalidator];
        if (cell) {
          next[__HMR_SYMBOLS.ComponentInvalidator] = cell;
          context.current.set(newInstance);
          cell.set(newInstance);
        }
      } catch (e) {
        if (e instanceof CellUpdateError) {
          for (const error of e.errors) errors.push(error);
        } else throw e;
      }
    }
  } finally {
    if (outerContext) {
      globalData.set(__HMR_SYMBOLS.HMRContextKey, outerContext);
    } else {
      globalData.delete(__HMR_SYMBOLS.HMRContextKey);
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
 * @param {__HMR_UpdatableFn} tagname
 * @param {any[]} props
 * @param {JSX.JSXDevFileData | undefined} fileData
 * @param {DOMRenderer} renderer
 */
export function withHMRBoundaries(tagname, props, fileData, renderer) {
  // Registered on every provider render, not just the first one, so the
  // registry always points at the instance that is actually on the chain.
  if (fileData && tagname.__isScopeProviderOf) {
    __HMR_SYMBOLS.registerScope(tagname.__isScopeProviderOf, fileData.fileName);
  }

  // In Dev mode and using HMR, components have a self-referential
  // Invalidator cell, which should automatically trigger a rerun of
  // the component.
  let invalidator = Reflect.get(tagname, __HMR_SYMBOLS.ComponentInvalidator);
  if (!invalidator) {
    invalidator = Cell.source(tagname);
    Reflect.set(tagname, __HMR_SYMBOLS.ComponentInvalidator, invalidator);
  }
  return runInvalidatorWithHMRBoundaries(invalidator, props, renderer);
}

/**
 * @param {Node[]} nodes
 * @param {DOMRenderer} renderer
 */
function stabilizeNodes(nodes, renderer) {
  // We can be smarter about whether or not to create a comment pair, so we
  // don't end up with a cluttered DOM tree.
  // NOTE TO FUTURE SELF: This optimization is only possible because
  // the comment ranges in other control flow structures already provide
  // guarantees about how nodes should behave.
  if (nodes.length === 0) return createCommentPair(renderer);

  if (nodes.length > 1) {
    const startNode = nodes[0];
    const endNode = nodes[nodes.length - 1];
    const isAlreadyStable =
      nodes.length > 1 &&
      startNode instanceof Comment &&
      endNode instanceof Comment &&
      isMatchingCommentPair(startNode, endNode);

    if (isAlreadyStable) return nodes;

    const pair = createCommentPair(renderer);
    return [pair[0], ...nodes, pair[1]];
  }

  // A group is a container, not a place in the document. It is emptied into
  // its parent on insertion, so a single group can never anchor an update.
  // Control flow structures return one, and its children carry the range
  // comments that make them stable.
  if (renderer.isGroup(nodes[0])) {
    return stabilizeNodes(renderer.unwrapGroup(nodes[0]), renderer);
  }

  return nodes;
}

/** @typedef {'start' | 'end'} SpanSide */

class ComponentSpan {
  /** @type {Node | ComponentSpan | null} */
  start = null;
  /** @type {Node | ComponentSpan | null} */
  end = null;
  disposed = false;
}

/** @type {WeakMap<Node, ComponentSpan>} */
const spanOwningNode = new WeakMap();

/**
 * @param {Node | ComponentSpan | null} edge
 * @param {SpanSide} side
 * @param {ComponentSpan} target
 */
function reachesSpan(edge, side, target) {
  for (let current = edge; current instanceof ComponentSpan; ) {
    if (current === target) return true;
    current = current[side];
  }
  return false;
}

/**
 * Reads a boundary through the chain of spans that borrowed it, until it
 * reaches the node that is in the document right now. A component that renders
 * exactly another component points at that component's span rather than
 * copying its nodes, so the boundary stays current when the child re-renders.
 *
 * @param {Node | ComponentSpan | null} edge
 * @param {SpanSide} side
 * @returns {Node | null}
 */
function resolveEdge(edge, side) {
  let current = edge;
  while (current instanceof ComponentSpan) {
    if (current.disposed) return null;
    current = current[side];
  }

  return current ?? null;
}

/**
 * @param {HmrContext} hmr
 * @param {Function} fn
 */
function isCoveredByParentUpdate(hmr, fn) {
  if (hmr.current.peek() !== fn) return false;
  // If a component render instance is in an update path, there is no use
  // updating it, since it will be (or has been) overwritten by its parent.
  const parents = __HMR_SYMBOLS.useComponentAncestry();
  return parents.some((c) => {
    return (c !== fn && hmr.old.includes(c)) || hmr.new.includes(c);
  });
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
  const base = branchState();
  const createGeneration = () => ({
    scopes: base.scopes,
    node: base.node.branch(),
    renderer: base.renderer,
  });

  /** @returns {Node[]} */
  const nextComponentRender = () => {
    const ancestry = __HMR_SYMBOLS.useComponentAncestry();
    const template = __HMR_SYMBOLS.RetendComponentTree.Provider({
      h: false,
      value: [...ancestry, value.peek()],
      children: () => value.peek()(...completeProps, { createdByJsx: true }),
    });
    return stabilizeNodes(
      createNodesFromTemplate(template, renderer),
      renderer
    );
  };

  const span = new ComponentSpan();

  /**
   * @param {Node} node
   * @param {SpanSide} side
   */
  const borrowEdge = (node, side) => {
    const owner = spanOwningNode.get(node);
    if (!owner || owner.disposed) return node;
    // A node reused across renders could otherwise point the chain back at
    // this span and make resolveEdge loop forever.
    if (reachesSpan(owner, side, span)) return node;
    return owner;
  };

  /** @param {Node[]} rendered */
  const commitSpan = (rendered) => {
    const first = rendered[0];
    const last = rendered[rendered.length - 1];
    span.start = borrowEdge(first, 'start');
    span.end = borrowEdge(last, 'end');
    // The outermost boundary to commit owns the nodes. An ancestor that
    // renders exactly this component then links to this span rather than to
    // a descendant that this component may later replace.
    spanOwningNode.set(first, span);
    spanOwningNode.set(last, span);
  };

  let generation = createGeneration();
  const nodes = withState(generation, nextComponentRender);
  commitSpan(nodes);

  /** @param {Function} fn */
  const refresh = (fn) => {
    if (span.disposed) return;
    const hmr = __HMR_SYMBOLS.getHMRContext();
    if (!hmr) return;
    // Skipping leaves the committed generation alive. When the update is
    // covered by a parent render, disposing the parent's old generation
    // cascades here; when it is not, the boundary is untouched.
    if (withState(generation, () => isCoveredByParentUpdate(hmr, fn))) return;

    const startNode = resolveEdge(span.start, 'start');
    const endNode = resolveEdge(span.end, 'end');
    if (!startNode?.isConnected || !endNode?.isConnected) return;

    const attempt = createGeneration();
    let rendered;
    try {
      rendered = withState(attempt, nextComponentRender);
    } catch (error) {
      attempt.node.dispose();
      throw error;
    }

    const range = renderer.host.document.createRange();
    range.setStartBefore(startNode);
    range.setEndAfter(endNode);
    range.deleteContents();
    range.insertNode(consolidateNodes(rendered, renderer));
    commitSpan(rendered);

    const previous = generation;
    generation = attempt;
    previous.node.dispose();
    void attempt.node.activate();
  };

  // Registered in the base node's context, so disposing the base removes the
  // listener along with it.
  base.node.addDispose(() => {
    span.disposed = true;
  });
  withState(base, () => value.listen(refresh));

  return nodes;
}
