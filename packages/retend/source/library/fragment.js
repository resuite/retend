/** @import { Renderer, Scope, SourceCell } from './index.js'; */
/** @import { JSX } from '../jsx-runtime/index.js' */

import { getSafeScopeContext } from '../_internals.js';
import { getGlobalContext } from '../context/index.js';
import { createScope } from './scope.js';
import { createNodesFromTemplate, linkNodes } from './utils.js';
/**
 * @typedef {Object} FragmentContext
 * @property {(group: any, nodes: any, handle?: any) => void} correlate
 */

/**
 * Props accepted by the JSX fragment (`<>...</>` / `<Fragment>`).
 *
 * @typedef {Object} FragmentProps
 * @property {JSX.Children} [children]
 * The fragment's content. A fragment renders its children directly into the
 * parent element — it never creates a wrapper element of its own.
 * @property {SourceCell<any[] | null>} [ref]
 * When set, receives the nodes rendered inside the fragment as an array, so
 * the fragment's output can be inspected as a single unit (an empty array
 * when nothing is rendered). The value is updated whenever the fragment's
 * content changes.
 */

const FragmentStashSymbol = Symbol('FragmentStash');

/** @type {Scope<FragmentContext>} */
export const TrackedFragmentScope = createScope('retend:Fragment');
export function useFragmentCtx() {
  return getSafeScopeContext(TrackedFragmentScope);
}

/**
 * Represents a JSX fragment in your markup.
 *
 * Both `<>...</>` and `<Fragment>...</Fragment>` compile to this component. A
 * fragment renders its children directly into the parent element without
 * adding a wrapper element of its own.
 *
 * Passing a `ref` cell makes the fragment trackable: the cell receives the
 * nodes rendered by the fragment's content (see `FragmentProps`).
 *
 * @param {FragmentProps} _props
 */
export function FragmentPlaceholder(_props) {}

/**
 *
 * @param {FragmentProps & { ref: SourceCell<any[] | null> }} props
 * @param {Renderer<any>} renderer
 */
export function Fragment(props, renderer) {
  const { ref, children } = props;
  const parentCtx = useFragmentCtx();
  const { globalData } = getGlobalContext();
  let allStashes = globalData.get(FragmentStashSymbol);
  if (!allStashes) {
    allStashes = new WeakMap();
    globalData.set(FragmentStashSymbol, allStashes);
  }
  let rendererStash = allStashes.get(renderer);
  if (!rendererStash) {
    rendererStash = {
      handleToNodes: new WeakMap(),
      groupToNodes: new WeakMap(),
    };
    allStashes.set(renderer, rendererStash);
  }

  const { handleToNodes, groupToNodes } = rendererStash;

  /** @type {FragmentContext} */
  const context = {
    correlate(group, nodes, handle) {
      groupToNodes.set(group, nodes);
      if (handle) {
        handleToNodes.set(handle, nodes);
      }
    },
  };

  const nodes = /** @type {object[]} */ (
    TrackedFragmentScope.Provider({
      value: context,
      h: false,
      children: () => createNodesFromTemplate(children, renderer),
    })
  );

  const leafs = [];
  /** @type {object[]} */
  const stack = [];
  for (let i = nodes.length - 1; i >= 0; i -= 1) stack.push(nodes[i]);
  while (stack.length > 0) {
    const node = stack.pop();
    const logical = groupToNodes.get(node);
    if (logical) {
      for (let i = logical.length - 1; i >= 0; i -= 1) stack.push(logical[i]);
    } else {
      leafs.push(node);
    }
  }

  ref.set(leafs);
  const group = renderer.createGroup();
  linkNodes(group, nodes, renderer);
  parentCtx?.correlate(group, nodes);
  return group;
}
