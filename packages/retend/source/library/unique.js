/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { SourceCell } from '@adbl/cells' */
/** @import { StateSnapshot, Scope } from '../library/scope.js' */
/** @import { Renderer } from '../library/renderer.js' */

import { Cell } from '@adbl/cells';

import { createGroupFromNodes } from '../_internals.js';
import { getGlobalContext } from '../context/index.js';
import {
  __HMR_SYMBOLS,
  branchState,
  createScope,
  MissingScopeError,
  onSetup,
  useScopeContext,
  withState,
} from '../library/scope.js';
import { useAwait } from './await.js';

const StashSymbol = Symbol('UniqueStash');
/** @type {Scope<Set<UniqueMoveFn>>} */
const UniqueScope = createScope('Unique');

/**
 * @typedef {WeakMap<object, Map<string | Function, UniqueCtx>>} RendererUniqueStash
 */

/**
 * @typedef UniqueCtx
 * @property {SourceCell<UniqueProps<any>>} props
 * @property {StateSnapshot} state
 * @property {Set<UniqueMoveFn>} moveFns
 * @property {Array<() => void>} restoreFns
 * @property {any[]} journey
 * @property {any[] | null} pendingNodes
 * @property {boolean} isStable
 * @property {number | null} idOfLastSavedHandle
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
 * @typedef {() => void | (() => void)} UniqueMoveFn
 */

/**
 * Registers a callback to be called when a unique component moves between
 * locations in the render tree.
 *
 * This hook is useful for preserving custom state
 * during transitions, or for performing cleanup/setup around the move.
 *
 * The callback runs just before the component is moved. Return a function
 * from the callback to run it after the move completes.
 *
 * @param {UniqueMoveFn} callback - A function to call before the component moves.
 *   Can optionally return a cleanup function to run after the move completes.
 *
 * @example
 * // Preserving focus during moves
 * const SearchInput = createUnique(() => {
 *   const inputRef = Cell.source(null);
 *
 *   onMove(() => {
 *     const input = inputRef.get();
 *     const wasFocused = input && document.activeElement === input;
 *     return () => {
 *       if (wasFocused && input) input.focus();
 *     };
 *   });
 *
 *   return <input ref={inputRef} type="search" placeholder="Search..." />;
 * });
 *
 * @throws {Error} If called outside of a unique component subtree.
 */
export function onMove(callback) {
  try {
    const set = useScopeContext(UniqueScope);
    set.add(callback);
  } catch (cause) {
    if (cause instanceof MissingScopeError) {
      const message = `onMove() cannot be used outside a unique subtree.`;
      throw new Error(message, { cause });
    }
  }
}

/**
 * @param {UniqueCtx} inst
 * @param {Renderer<any>} renderer
 * @returns {number}
 */
const save = (inst, renderer) => {
  // if there is a last saved handle, there is a pending save that
  // needs to be restored before saving again.
  if (inst.idOfLastSavedHandle !== null) return inst.idOfLastSavedHandle;
  // If there are pending restore function, we need to clear them
  // before saving again.
  for (const move of inst.moveFns) {
    try {
      const restoreFn = move();
      if (restoreFn) inst.restoreFns.push(restoreFn);
    } catch (e) {
      console.error(e);
    }
  }
  const handle = inst.journey[inst.journey.length - 1];
  return renderer.save(handle);
};

/** @param {UniqueCtx} inst */
const runRestoreFns = (inst) => {
  for (const fn of inst.restoreFns) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
  inst.restoreFns.length = 0;
};

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
  /** @param {UniqueProps<Props>} nextProps */
  const UniqueComponent = (nextProps) => {
    const { globalData, renderer } = getGlobalContext();
    if (!renderer) throw new Error('No renderer available');

    const key = nextProps.id ?? renderFn;
    const { host } = renderer;
    const awaitCtx = useAwait();

    /** @type {RendererUniqueStash} */
    let stash = globalData.get(StashSymbol);
    if (!stash) globalData.set(StashSymbol, (stash = new WeakMap()));

    let instances = stash.get(renderer);
    if (!instances) stash.set(renderer, (instances = new Map()));

    let instance = instances.get(key);
    let group;
    /** @type {any} */
    let handle;

    if (!instance) {
      // First Instance of createUnique, create normally.
      const props = Cell.source(nextProps);
      const state = branchState();
      const moveFns = new Set();
      const output = withState(state, () => {
        return UniqueScope.Provider({
          value: moveFns,
          children: () => renderFn(props),
        });
      });

      group = createGroupFromNodes(output, renderer);
      const pendingNodes = renderer.unwrapGroup(group);
      handle = renderer.createGroupHandle(group);

      instance = {
        props,
        state,
        moveFns,
        restoreFns: [],
        journey: [handle],
        pendingNodes,
        isStable: false,
        idOfLastSavedHandle: null,
      };
      instances.set(key, instance);
    } else {
      group = renderer.createGroup();
      handle = renderer.createGroupHandle(group);
      instance.props.set(nextProps);

      // In the case where there are multiple awaiting instances, we
      // have to keep resaving and re-restoring as we propagate to the last one.
      const length = instance.journey.length;
      const move = () => {
        const instance = instances.get(key);
        if (!instance) return;

        if (length !== instance.journey.length || !instance.isStable) {
          // Next instance, when last instance is not yet stable.
          // Move the nodes, but do not run move effects.
          const previousHandle = instance.journey[instance.journey.length - 1];
          instance.journey.push(handle);
          if (instance.pendingNodes) {
            renderer.write(handle, instance.pendingNodes);
            instance.pendingNodes = null;
          } else {
            instance.idOfLastSavedHandle = renderer.save(previousHandle);
            renderer.restore(instance.idOfLastSavedHandle, handle);
          }
        } else {
          // Next instance, when last instance is stable.
          // Move and run effects.
          // If last instance was already disposed, it would have already
          // run the moveFn effects, so all we need to do is restore. If it is an
          // active instance however, we need to run both save() and restore()
          // on the fly.
          instance.idOfLastSavedHandle = save(instance, renderer);
          instance.journey.push(handle);
          renderer.restore(instance.idOfLastSavedHandle, handle);
          // Yes this is not ideal, but abeg.
          // The correct place for this to run is in onSetup(),
          // after the subtree has been surely appended, but
          // that happens too late, and the animations in retend-utils
          // that depend on timing end up with a split-second glitch.
          // This is the best we can do without a major rearchitect.
          queueMicrotask(() => runRestoreFns(instance));
        }
      };
      if (awaitCtx && !awaitCtx.done) awaitCtx.finished.then(move);
      else move();
    }

    onSetup(() => {
      instance.pendingNodes = null;
      if (!instance.isStable) instance.isStable = true;
      instance.idOfLastSavedHandle = null;

      return () => {
        // This detaches it from the parent node, preventing
        // dispose() from cascading, and keeping its context alive
        // when moved.
        instance.state.node.disable();
        instance.idOfLastSavedHandle = save(instance, renderer);

        const teardown = () => {
          const index = instance.journey.indexOf(handle);
          if (index !== -1) instance.journey.splice(index, 1);

          if (instance.journey.length == 0) {
            // The Unique component's journey has ended, there are no more handles.
            // Restoring to nothing helps flush the renderer state.
            instance.state.node.enable(); // needed for dispose()
            instance.state.node.dispose();
            if (instance.idOfLastSavedHandle !== null) {
              renderer.restore(instance.idOfLastSavedHandle, null);
            }
            instances.delete(key);
          } else {
            // There is no forward handle to restore, so we restore to the last one in the journey.
            const last = instance.journey[instance.journey.length - 1];
            if (instance.idOfLastSavedHandle !== null) {
              renderer.restore(instance.idOfLastSavedHandle, last);
              runRestoreFns(instance);
              // Reset to indicate the saved state has been used and we're ready
              // for a new save cycle. This allows save() to call moveFns in
              // subsequent moves after runPendingSetupEffects() has been called.
              instance.idOfLastSavedHandle = null;
            }
          }
        };
        host.addEventListener('retend:activate', teardown, { once: true });
      };
    });

    return group;
  };

  UniqueComponent.__retendUnique = true;
  const name = renderFn.name || 'Unique.Content';
  Object.defineProperty(UniqueComponent, 'name', { value: name });
  if (!renderFn.name) Object.defineProperty(renderFn, 'name', { value: name });

  return UniqueComponent;
}
