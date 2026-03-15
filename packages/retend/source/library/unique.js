/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { SourceCell } from '@adbl/cells' */
/** @import { StateSnapshot } from '../library/scope.js' */

import { Cell } from '@adbl/cells';

import { getGlobalContext } from '../context/index.js';
import {
  __HMR_SYMBOLS,
  branchState,
  createScope,
  withState,
} from '../library/scope.js';
import { createNodesFromTemplate } from './index.js';

const StashSymbol = Symbol('UniqueStash');
const UniqueScope = createScope('Unique');

/**
 * @typedef {WeakMap<object, Map<string | Function, UniqueCtx>>} RendererUniqueStash
 */

/**
 * @typedef UniqueCtx
 * @property {SourceCell<UniqueProps<any>>} propsCell
 * @property {StateSnapshot} state
 * @property {any} handle
 * @property {any | null} previousHandle
 */

/**
 * @template {{}} Props
 * @typedef {{ id?: string } & Props} UniqueProps
 */

/**
 * @template {{}} Props
 * @typedef {(props: UniqueProps<Props>) => JSX.Template} UniqueComponent
 */

/**
 * @template {{}} Props
 * @typedef {(props: Cell<UniqueProps<Props>>) => JSX.Template} UniqueComponentRenderFn
 */

/**
 * Creates a component that preserves its identity and internal state
 * even when its position in the render tree changes. Rather than being destroyed
 * and recreated each time it renders, it persists one instance across different locations.
 *
 * By default, the component's identity is tied to the render function itself. To distinguish
 * between multiple shared instances of the same component, you can provide an explicit `id` prop.
 *
 * Props remain fully reactive: any changes propagate through a Cell and automatically
 * trigger re-evaluation of any derived values or effects inside the component.
 *
 * When a unique instance is removed from one place in the UI and later rendered elsewhere,
 * it carries over its entire state intact, including:
 * - All child nodes and their internal state
 * - Any scoped reactive computations
 *
 * The component is only fully disposed once it is no longer rendered anywhere.
 *
 * Common use cases include:
 * - Media players that need to keep their playback position and state
 *   during navigation or layout shifts
 * - Form inputs that should retain their value, focus, and caret position
 * - Expensive computations, WebSocket connections, or other heavy resources
 *   that shouldn't be torn down unnecessarily
 * - Stateful widgets that are moved between different containers or tabs
 *
 * @example
 * const UniqueCounter = createUnique((props) => {
 *   const count = Cell.source(0);
 *   const increment = () => count.set(count.get() + 1);
 *   return (
 *     <div>
 *       <button onClick={increment}>Count: {count}</button>
 *     </div>
 *   );
 * });
 *
 * // Renders the same instance regardless of where it appears
 * <UniqueCounter />
 *
 * @example
 * // With id - multiple instances distinguished by id prop
 * const UniqueVideoPlayer = createUnique((props) => {
 *   const src = Cell.derived(() => props.get().src);
 *   return <video src={src} controls />;
 * });
 *
 * // Each id creates a separate persistent instance
 * <UniqueVideoPlayer id="main" src="/video1.mp4" />
 * <UniqueVideoPlayer id="pip" src="/video2.mp4" />
 *
 * @example
 * // With custom state management
 * const UniqueCanvas = createUnique((props) => {
 *   const canvas = Cell.source(null);
 *
 *   onSetup(() => {
 *     const node = canvas.get();
 *     if (!node) return;
 *     // Initialize canvas context, listeners, etc.
 *     const ctx = node.getContext('2d');
 *     // ... setup
 *   });
 *
 *   return <canvas ref={canvas} />;
 * });
 *
 * @template {{}} Props - Props type (excluding id, which is added automatically)
 * @param {UniqueComponentRenderFn<Props>} renderFn
 *   Function that receives reactive props as a Cell and returns a template.
 *   Props updates propagate reactively through the Cell.
 *
 * @returns {UniqueComponent<Props>}
 *   A component function that accepts props including an optional `id` string.
 *   When `id` is omitted, a single instance is created per renderFn.
 *   When `id` is provided, separate instances are created for each unique id.
 */
export function createUnique(renderFn) {
  /** @param {UniqueProps<Props>} props */
  const UniqueComponent = (props) => {
    const { globalData, renderer } = getGlobalContext();
    if (!renderer) throw new Error('No renderer available');
    let group;

    /** @type {RendererUniqueStash} */
    let ctx = globalData.get(StashSymbol);
    if (!ctx) {
      ctx = new WeakMap();
      globalData.set(StashSymbol, ctx);
    }

    let rendererCtx = ctx.get(renderer);
    if (!rendererCtx) {
      rendererCtx = new Map();
      ctx.set(renderer, rendererCtx);
    }

    const key = props.id ?? renderFn; // todo: we need a better way to prevent collisions if multiple components share an id namespace.
    let uniqueCtx = rendererCtx.get(key);
    if (!uniqueCtx) {
      // FIRST RUN.
      const propsCell = Cell.source(props);
      const state = branchState();
      const output = withState(state, () => {
        return UniqueScope.Provider({
          value: {}, // todo. This will keep track of onMove()
          children: () => renderFn(propsCell),
        });
      });
      state.node.disable(); // Prevents detachment of the parent scope from affecting this.
      const nodes = createNodesFromTemplate(output, renderer);
      group = createNodesFromTemplate(nodes, renderer);
      const handle = renderer.createGroupHandle(group);

      uniqueCtx = { propsCell, state, handle, previousHandle: null };
      rendererCtx.set(key, uniqueCtx);
    } else {
      group = renderer.createGroup();
      const handle = renderer.createGroupHandle(group);
      renderer.transfer(uniqueCtx.previousHandle, handle);
    }

    return group;
  };

  UniqueComponent.__retendUnique = true;
  Object.defineProperty(UniqueComponent, 'name', { value: renderFn.name });
  if (!renderFn.name) {
    Object.defineProperty(renderFn, 'name', { value: 'Unique.Content' });
  }
  return UniqueComponent;
}
