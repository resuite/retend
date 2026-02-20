/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { Scope } from './scope.js'; */
/** @import { SourceCell } from '@adbl/cells'; */

import { AsyncCell, Cell } from '@adbl/cells';
import { If, createNodesFromTemplate, getActiveRenderer } from './index.js';
import {
  createScope,
  branchState,
  onSetup,
  useScopeContext,
  withStateSnapshot,
} from './scope.js';
import { getGlobalContext } from '../context/index.js';

/**
 * @typedef AwaitContext
 * @property {(cell: AsyncCell<any>) => Promise<void>} waitUntil
 */

/**
 * @typedef AwaitProps
 * @property {JSX.Template} fallback
 * @property {JSX.Template} children
 */

/** @type {Scope<AwaitContext>} */
const AwaitScope = createScope('retend:Await');
const AsyncKey = Symbol('retend:Await');

/**
 * Pauses the rendering of a component tree until all asynchronous operations
 * within it have completed.
 *
 * This component acts as a boundary for async states. It is useful for
 * coordinating the loading states of multiple nested components, ensuring
 * they appear together only when fully prepared on the initial render.
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
  const { globalData } = getGlobalContext();
  const asyncHolders = globalData.get(AsyncKey) ?? new Set();
  globalData.set(AsyncKey, asyncHolders);
  const initialStateDone = Cell.source(false);
  /** @type {SourceCell<Set<AsyncCell<any>>>} */
  const asyncCells = Cell.source(new Set());
  const awaitList = Cell.derivedAsync(async (get) => {
    await Promise.all([...get(asyncCells).values()].map(get));
  });
  /** @type {Promise<void>} */
  const waitingPromise = new Promise((resolve) => {
    initialStateDone.listen(() => {
      resolve();
      asyncHolders.delete(waitingPromise);
    });
  });
  asyncHolders.add(waitingPromise);

  /** @type {AwaitContext} */
  const value = {
    waitUntil(promise) {
      if (initialStateDone.get()) return waitingPromise;
      const set = asyncCells.peek();
      if (!set.has(promise)) {
        const newSet = new Set(set);
        newSet.add(promise);
        asyncCells.set(newSet);
      }
      return waitingPromise;
    },
  };

  const snapshot = branchState();
  snapshot.node.suspend();

  const render = withStateSnapshot(snapshot, () => {
    const template = AwaitScope.Provider({ value, children });
    return createNodesFromTemplate(template, renderer);
  });

  awaitList.pending.listen(() => {
    initialStateDone.set(true);
  });

  onSetup(() => {
    return () => asyncHolders.delete(waitingPromise);
  });

  return If(initialStateDone, {
    true: () => {
      snapshot.node.unsuspend();
      snapshot.node.enable();
      onSetup(() => {
        asyncCells.set(new Set());
        // will dispose automatically from parent scope.
        snapshot.node.activate();
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

/**
 * Waits for all active `Await` boundaries to resolve.
 *
 * This is primarily used by renderers to ensure
 * all asynchronous data has loaded before serializing the page.
 *
 * @returns {Promise<void>}
 */
export async function waitForAsyncBoundaries() {
  const { globalData } = getGlobalContext();
  /** @type {Set<any>} */
  const holders = globalData.get(AsyncKey);
  if (!holders?.size) return;
  while (holders.size) {
    await Promise.all([...holders]);
  }
}
