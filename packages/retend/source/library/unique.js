/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { SourceCell } from '@adbl/cells' */
/** @import { StateSnapshot, Scope } from '../library/scope.js' */
/** @import { Renderer } from '../library/renderer.js' */
/** @import { FragmentContext } from './fragment.js' */

import { Cell } from '@adbl/cells';

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
import { correlate, TrackedFragmentScope, useFragmentCtx } from './fragment.js';

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
 * @property {unknown[]} logicalNodes
 * @property {Set<UniqueMoveFn>} moveFns
 * @property {Array<() => void>} restoreFns
 * @property {Array<[any, any, UniqueProps<any>, FragmentContext | null]>} journey
 * Handle, group, props and fragment context corresponding to a point in the journey
 * @property {ReturnType<typeof useAwait>} pendingAwait
 * @property {(() => void) | undefined} render
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
    onSetup(() => () => set.delete(callback));
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
  const handle = inst.journey[inst.journey.length - 1][0];
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
    /** @type {FragmentContext | null} */
    const fragmentCtx = useFragmentCtx();
    const group = renderer.createGroup();
    const handle = renderer.createGroupHandle(group);

    if (!instance) {
      // A Unique instance owns its lifecycle independently of every location
      // it visits. Location teardown leaves it alive; journey teardown calls
      // dispose() on this retained branch directly.
      const state = branchState('retained');
      state.data = { handle };
      const moveFns = new Set();
      /** @type {UniqueCtx} */
      let newInstance;
      /**
       * The fragment context of the location the instance is currently rendered
       * at (the last point in its journey). This is resolved at call time because
       * the provider is shared across every location the instance visits, so the
       * enclosing fragment can change between points.
       * @returns {FragmentContext | null}
       */
      const getActiveFragmentCtx = () => {
        const journey = newInstance?.journey;
        if (!journey || journey.length === 0) return null;
        return journey[journey.length - 1][3] ?? null;
      };
      /** @type {FragmentContext} */
      const trackedFragmentProviderProps = {
        correlate(group, nodes, handle) {
          // The reasoning for this is to allow the reactive primitives within the
          // Unique.Content to still be correlated globally, even if the Unique itself is not
          // inside a TrackedFragmentScope, for the case where it could later move into one.
          // The alternative would be to always correlate reactive groups regardless of whether
          // they are inside a TrackedFragmentScope or not, which would be less efficient.
          correlate(group, nodes, renderer, handle);
          // Re-resolve the enclosing fragment's ref so it tracks nodes that
          // changed inside the Unique (e.g. a reactive If switching branches).
          getActiveFragmentCtx()?.invalidate();
        },
        invalidate() {
          getActiveFragmentCtx()?.invalidate();
        },
      };
      const providerProps = [
        {
          value: moveFns,
          children: () =>
            TrackedFragmentScope.Provider({
              value: trackedFragmentProviderProps,
              children: () => renderFn(newInstance.props),
            }),
        },
      ];
      const props = withState(state, () => Cell.source(nextProps));

      /** @type {UniqueCtx} */
      newInstance = {
        props,
        state,
        logicalNodes: [],
        moveFns,
        restoreFns: [],
        journey: [[handle, group, nextProps, fragmentCtx]],
        pendingAwait: awaitCtx,
        render() {
          const pendingAwait = newInstance.pendingAwait;
          const commit = () => {
            if (
              instances.get(key) !== newInstance ||
              !newInstance.render ||
              newInstance.pendingAwait !== pendingAwait
            )
              return;
            if (pendingAwait && !pendingAwait.done) {
              instances.delete(key);
              state.node.dispose();
              return;
            }
            const Provider = UniqueScope.Provider;
            const raw = withState(state, () =>
              renderer.handleComponent(Provider, providerProps, state)
            );
            const logicalNodes = Array.isArray(raw) ? raw : raw ? [raw] : [];
            // Checking the last handle/group helps us avoid a scenario where a pending instance point
            // is dropped before it can be resolved, or another instance point supercedes it
            const [currentHandle, currentGroup] =
              newInstance.journey[newInstance.journey.length - 1];
            newInstance.logicalNodes = logicalNodes;
            correlate(currentGroup, logicalNodes, renderer, currentHandle);
            // The stash now reflects the freshly committed nodes, so re-resolve
            // any enclosing fragment refs that include this instance.
            getActiveFragmentCtx()?.invalidate();
            renderer.write(currentHandle, logicalNodes);
            newInstance.render = undefined;
          };
          if (pendingAwait && !pendingAwait.done)
            pendingAwait.finished.then(commit);
          else commit();
        },
        isStable: false,
        idOfLastSavedHandle: null,
      };
      instance = newInstance;
      instances.set(key, newInstance);
      newInstance.render?.();
    } else {
      instance.props.set(nextProps);

      // In the case where there are multiple awaiting instances, we
      // have to keep resaving and re-restoring as we propagate to the last one.
      const length = instance.journey.length;
      const move = () => {
        const instance = instances.get(key);
        if (!instance) return;

        const previousPoint = instance.journey[instance.journey.length - 1];
        const [previousHandle, previousGroup] = previousPoint;
        if (length !== instance.journey.length || !instance.isStable) {
          // Next instance, when last instance is not yet stable.
          // Move the nodes, but do not run move effects.
          instance.journey.push([handle, group, nextProps, fragmentCtx]);
          instance.idOfLastSavedHandle = renderer.save(previousHandle);
          renderer.restore(instance.idOfLastSavedHandle, handle);
          instance.idOfLastSavedHandle = null;
        } else {
          // Next instance, when last instance is stable.
          // Move and run effects.
          // If last instance was already disposed, it would have already
          // run the moveFn effects, so all we need to do is restore. If it is an
          // active instance however, we need to run both save() and restore()
          // on the fly.
          instance.idOfLastSavedHandle = save(instance, renderer);
          instance.journey.push([handle, group, nextProps, fragmentCtx]);
          renderer.restore(instance.idOfLastSavedHandle, handle);
          instance.idOfLastSavedHandle = null;
          // Yes this is not ideal, but abeg.
          // The correct place for this to run is in onSetup(),
          // after the subtree has been surely appended, but
          // that happens too late, and the animations in retend-utils
          // that depend on timing end up with a split-second glitch.
          // This is the best we can do without a major rearchitect.
          queueMicrotask(() => runRestoreFns(instance));
        }
        // The nodes physically left the previous group, so it now contains
        // nothing — update its correlation (and the old handle's) to match.
        correlate(previousGroup, [], renderer, previousHandle);
        previousPoint[3]?.invalidate();
        // The moved nodes are the same ones, so the new group maps to the
        // last committed logical nodes.
        correlate(group, instance.logicalNodes, renderer, handle);
        fragmentCtx?.invalidate();
      };
      if (instance.render) {
        instance.journey = [[handle, group, nextProps, fragmentCtx]];
        /** @type {{ handle: any }} */ (instance.state.data).handle = handle;
        instance.pendingAwait = awaitCtx;
        instance.render();
      } else if (awaitCtx && !awaitCtx.done) {
        awaitCtx.finished.then(() => {
          if (awaitCtx.done) move();
        });
      } else move();
    }

    onSetup(() => {
      if (!instance.isStable) instance.isStable = true;
      instance.idOfLastSavedHandle = null;

      return () => {
        const hmrContext = __HMR_SYMBOLS.getHMRContext();
        if (hmrContext?.current) {
          instance.state.node.dispose();
          instances.delete(key);
          return;
        }
        const isLastHandle =
          instance.journey[instance.journey.length - 1][0] === handle;
        if (isLastHandle) {
          instance.idOfLastSavedHandle = save(instance, renderer);
        }

        const teardown = () => {
          const index = instance.journey.findIndex(([item]) => item === handle);
          if (index !== -1) {
            const [removed] = instance.journey.splice(index, 1);
            const removedGroup = removed[1];
            correlate(removedGroup, [], renderer, handle);
          }

          if (instance.journey.length == 0) {
            // The Unique component's journey has ended, there are no more handles.
            // Restoring to nothing helps flush the renderer state.
            instance.state.node.dispose();
            if (instance.idOfLastSavedHandle !== null) {
              renderer.restore(instance.idOfLastSavedHandle, null);
              instance.idOfLastSavedHandle = null;
            }
            instances.delete(key);
          } else {
            // There is no forward handle to restore, so we restore to the last one in the journey.
            const [lastHandle, lastGroup, lastProps, lastFragmentCtx] =
              instance.journey[instance.journey.length - 1];
            if (isLastHandle && instance.idOfLastSavedHandle !== null) {
              instance.props.set(lastProps);
              correlate(lastGroup, instance.logicalNodes, renderer, lastHandle);
              renderer.restore(instance.idOfLastSavedHandle, lastHandle);
              lastFragmentCtx?.invalidate();
              runRestoreFns(instance);
              // Reset to indicate the saved state has been used and we're ready
              // for a new save cycle. This allows save() to call moveFns in
              // subsequent moves after runPendingSetupEffects() has been called.
              instance.idOfLastSavedHandle = null;
            }
          }
        };
        const hasRestoreTarget = instance.journey.length > 1;
        if (hasRestoreTarget) queueMicrotask(teardown);
        else host.addEventListener('retend:activate', teardown, { once: true });
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
