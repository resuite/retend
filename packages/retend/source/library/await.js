/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { Scope } from './scope.js'; */
/** @import { SourceCell } from '@adbl/cells'; */

import { AsyncCell, Cell } from '@adbl/cells';
import { createScope, useScopeContext } from './scope.js';
import { createNodesFromTemplate, getActiveRenderer, If } from './index.js';

/**
 * @typedef AwaitContext
 * @property {boolean} isLoaded
 * @property {(promise: AsyncCell<any>) => void} waitUntil
 */

/**
 * @typedef AwaitProps
 * @property {JSX.Template} fallback
 * @property {JSX.Template} children
 */

/** @type {Scope<AwaitContext>} */
const AwaitScope = createScope('retend:Await');

/**
 * Suspends the rendering of a component tree until all asynchronous operations
 * within it have completed.
 *
 * This component acts as a boundary for async states. It immediately evaluates
 * the `children` to initiate any pending tasks, but prevents them from being
 * output until they are ready. Instead, the `fallback` template is displayed.
 *
 * It is useful for coordinating the loading states of multiple nested components,
 * ensuring they appear together only when fully prepared.
 *
 * @param {AwaitProps} props
 * @returns {JSX.Template}
 *
 * @example
 * ```jsx
 * <Await fallback={<Spinner />}>
 *   <UserProfile id="123" />
 * </Await>
 * ```
 */
export function Await(props) {
  const { children, fallback } = props;
  const renderer = getActiveRenderer();
  const initialStateDone = Cell.source(false);
  /** @type {SourceCell<Set<AsyncCell<any>>>} */
  const asyncCells = Cell.source(new Set());
  const awaitList = Cell.derivedAsync(async (get) => {
    await Promise.all([...get(asyncCells).values()].map((cell) => get(cell)));
    return await new Promise((r) => setTimeout(r));
  });

  /** @type {AwaitContext} */
  const value = {
    isLoaded: false,
    waitUntil(promise) {
      if (initialStateDone.get()) {
        return;
      }
      const set = new Set(asyncCells.get());
      set.add(promise);
      asyncCells.set(set);
    },
  };

  const template = AwaitScope.Provider({ value, children });
  const render = createNodesFromTemplate(template, renderer);

  const showRender = Cell.derived(() => {
    return initialStateDone.get() || !awaitList.pending.get();
  });

  return If(showRender, {
    true: () => {
      Cell.batch(() => {
        initialStateDone.set(true);
        asyncCells.set(new Set()); // Prevents memory leak.
      });
      return render;
    },
    false: () => fallback || null,
  });
}

/**
 * Retrieves the nearest await control context.
 *
 * This hook is used internally by the framework to register asynchronous
 * dependencies with an `Await` boundary.
 *
 * @internal
 * @returns {AwaitContext | null}
 */
export function useAwait() {
  try {
    return useScopeContext(AwaitScope);
  } catch {
    return null;
  }
}
