/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { Scope } from './scope.js'; */
/** @import { SourceCell } from '@adbl/cells'; */

/** @import { AsyncCell } from '@adbl/cells'; */
import { Cell } from '@adbl/cells';

import { getGlobalContext } from '../context/index.js';
import { getActiveRenderer, normalizeJsxChild } from './index.js';
import {
  createScope,
  branchState,
  getState,
  useScopeContext,
  withState,
} from './scope.js';

/**
 * @typedef {{
 *   waitUntil: (cell: AsyncCell<any>) => Promise<void>
 *   readonly finished: Promise<void>
 *   readonly done: boolean
 * }} AwaitContext
 */

/**
 * @typedef AwaitProps
 * @property {JSX.Template} [fallback]
 * @property {JSX.Children} [children]
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
  const { globalData } = getGlobalContext();
  const renderer = getActiveRenderer();
  const asyncHolders = globalData.get(AsyncKey) ?? new Set();
  globalData.set(AsyncKey, asyncHolders);
  const initialStateDone = Cell.source(false);
  /** @type {SourceCell<Set<AsyncCell<any>>>} */
  const asyncCells = Cell.source(new Set());
  const awaitList = Cell.derivedAsync(async (get) => {
    await Promise.all([...get(asyncCells).values()].map(get));
  });
  /** @type {Promise<void>} */
  const finished = Promise.race([
    new Promise((resolve) => {
      initialStateDone.listen(() => {
        // @ts-expect-error: Writable within Await.
        value.done = true;
        queueMicrotask(() => resolve(undefined));
      });
    }),
    new Promise((resolve) => {
      getState().node.addDispose(() => resolve(undefined));
    }),
  ]);
  /** @type {Promise<void>} */
  const waitingPromise = finished.then(() => {
    asyncHolders.delete(waitingPromise);
  });
  asyncHolders.add(waitingPromise);

  /** @type {AwaitContext} */
  const value = {
    waitUntil(promise) {
      if (initialStateDone.get()) {
        const current = promise.get();
        const disposed = new Promise((resolve) => {
          getState().node.addDispose(() => resolve(undefined));
        });
        const holder = Promise.race([current, disposed]);
        asyncHolders.add(holder);
        return holder.finally(() => asyncHolders.delete(holder));
      }
      const set = asyncCells.peek();
      if (!set.has(promise)) {
        const newSet = new Set(set);
        newSet.add(promise);
        asyncCells.set(newSet);
      }
      return waitingPromise;
    },
    done: false,
    finished,
  };

  const group = renderer.createGroup();
  const handle = renderer.createGroupHandle(group);
  const snapshot = branchState();
  snapshot.data = { handle };
  snapshot.node.suspend();
  const fallbackSnapshot = branchState();
  fallbackSnapshot.data = { handle };

  const AwaitContent = () => {
    return AwaitScope.Provider({ value, children });
  };
  Object.defineProperty(AwaitContent, 'name', { value: 'Await.Content' });

  const render = withState(snapshot, () => {
    return normalizeJsxChild(
      renderer.handleComponent(AwaitContent, [], snapshot),
      renderer
    );
  });

  awaitList.pending.listen((isPending) => {
    if (!isPending) initialStateDone.set(true);
  });

  const showContent = () => {
    fallbackSnapshot.node.dispose();
    renderer.write(handle, Array.isArray(render) ? render : [render]);
    snapshot.node.unsuspend();
    snapshot.node.enable();
    asyncCells.set(new Set());
    snapshot.node.activate();
  };

  initialStateDone.listen(showContent);
  if (initialStateDone.get()) showContent();
  else {
    const fallbackNodes = withState(fallbackSnapshot, () =>
      renderer.handleComponent(() => fallback ?? null, [], fallbackSnapshot)
    );
    renderer.write(
      handle,
      Array.isArray(fallbackNodes) ? fallbackNodes : [fallbackNodes]
    );
  }
  return group;
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
  while (true) {
    await Promise.resolve();
    /** @type {Set<any>} */
    const holders = globalData.get(AsyncKey);
    if (holders?.size) {
      await Promise.all(holders);
      continue;
    }
    await Promise.resolve();
    if (!globalData.get(AsyncKey)?.size) return;
  }
}
