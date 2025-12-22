/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { useObserver, CleanupFn } from './observer.js' */
import { Cell } from '@adbl/cells';
import h from './jsx.js';
import {
  getHMRScopeList,
  HMRContextKey,
  HmrId,
  OverwrittenBy,
} from '../hmr/index.js';
import { getActiveRenderer } from './renderer.js';
import { getGlobalContext } from '../context/index.js';
import { createNodesFromTemplate } from './utils.js';

/**
 * @template [T=unknown]
 * @typedef ScopePropsWithChildren
 * @property {() => JSX.Template} children
 * @property {T} value
 */

/**
 * @template [T=unknown]
 * @typedef ScopePropsWithContent
 * @property {() => JSX.Template} content
 * @property {T} value
 */

/**
 * @template [T=unknown]
 * @typedef {ScopePropsWithChildren<T> | ScopePropsWithContent<T>} ScopeProps
 */

/**
 * @template [T=any]
 * @typedef Scope
 * @property {symbol} key
 * @property {(props: ScopeProps<T>) => JSX.Template} Provider
 */

/**
 * @typedef ScopeSnapshot
 * @property {Map<Scope, unknown[]>} scopes
 * @property {EffectNode} node
 */

/**
 * @typedef {(() => CleanupFn | undefined) | (() => Promise<CleanupFn | undefined>) | (() => void | Promise<void>) } SetupFn
 */

/**
 * Represents a node managing effects and cleanup within a hierarchy.
 * Allows enabling/disabling, forking child nodes, and disposing by cleaning effects and children.
 */
class EffectNode {
  /** @type {Array<SetupFn>} */ #setupFns = [];
  /** @type {Array<() => (Promise<void> | void)>} */ #disposeFns = [];
  /** @type {Array<EffectNode>} */ #children = [];
  #enabled = false;
  #active = false;
  localContext = Cell.context();

  enable() {
    const renderer = getActiveRenderer();
    if (renderer.capabilities.supportsSetupEffects) {
      this.#enabled = true;
      for (const child of this.#children) child.enable();
    }
  }

  disable() {
    this.#enabled = false;
    for (const child of this.#children) child.disable();
  }

  /** @param {SetupFn} effect  */
  add(effect) {
    this.#setupFns.push(effect);
  }

  branch() {
    const newNode = new EffectNode();
    newNode.#enabled = this.#enabled;
    this.#children.push(newNode);
    return newNode;
  }

  async #runActivateFns() {
    if (!this.#enabled || this.#active) return;
    for (const effect of this.#setupFns) {
      try {
        const cleanup = await effect();
        if (typeof cleanup === 'function') this.#disposeFns.push(cleanup);
      } catch (error) {
        console.error(error);
      }
    }
    this.#active = true;
    const promises = [];
    for (const child of this.#children) {
      if (!child.#enabled || child.#active) continue;
      promises.push(child.#runActivateFns());
    }
    await Promise.all(promises);
  }

  async activate() {
    if (!this.#enabled || this.#active) return;
    const { host } = getActiveRenderer();
    await new Promise((resolve) => setTimeout(resolve));
    await this.#runActivateFns();
    host.dispatchEvent(new Event('retend:activate'));
  }

  #runDisposeFns() {
    if (!this.#enabled || !this.#active) return;
    for (const effect of this.#disposeFns) {
      try {
        effect();
      } catch (error) {
        console.error('Cleanup effect failed:', error);
      }
    }
    this.#active = false;
    for (const child of this.#children) {
      child.#runDisposeFns();
    }
    this.localContext.destroy();
  }

  dispose() {
    const renderer = getActiveRenderer();
    if (!renderer.capabilities.supportsSetupEffects) {
      for (const child of this.#children) child.localContext.destroy();
      this.localContext.destroy();
      this.localContext = Cell.context();
    }

    if (!this.#enabled || !this.#active) return;
    this.#runDisposeFns();

    for (const child of this.#children) {
      // prevents any side effects from being triggered in the
      // (soon to be) orphaned subtrees, when any of their control
      // structures receives changes.
      child.disable();
    }

    this.#setupFns.length = 0;
    this.#disposeFns.length = 0;
    this.#children.length = 0;

    if (!renderer.capabilities.supportsSetupEffects) {
      this.localContext.destroy();
      this.localContext = Cell.context();
    }
  }

  detach() {
    const node = new EffectNode();
    node.#setupFns = [...this.#setupFns];
    node.#disposeFns = [...this.#disposeFns];
    node.#children = [...this.#children];

    this.dispose();
    return node;
  }

  /** @param {EffectNode} node  */
  attach(node) {
    this.#active = node.#active;
    this.#enabled = node.#enabled;
    this.#children = [...node.#children];
    this.#setupFns = [...node.#setupFns];
    this.#disposeFns = [...node.#disposeFns];
  }
}

class RootEffectNode extends EffectNode {}

const SNAPSHOT_KEY = Symbol('__ACTIVE_SCOPE_SNAPSHOT__');

/**
 * Creates a synchronous scope that can be provided and consumed within a component tree.
 * This allows for passing data down through components without explicit prop drilling.
 *
 * @template [T=unknown]
 * @param {string} [name] - The name of the scope.
 * @returns {Scope<T>} A Provider component.
 *
 * @example
 * ```js
 * const UserInfoScope = createScope();
 *
 * function App() {
 *    const userInfo = { name: 'Alice' };
 *    return <UserInfoScope.Provider value={userInfo} content={ChildComponent} />
 * }
 *
 * function ChildComponent() {
 *    const user = useScopeContext(UserInfoScope);
 *    return <p>User: {user.name}</p>
 * }
 * ```
 */
export function createScope(name) {
  /** @type {Scope<T>} */
  const Scope = {
    key: Symbol(name ?? 'Scope'),
    Provider: (props) => {
      const renderFn =
        'content' in props
          ? props.content
          : 'children' in props
            ? props.children
            : () => {};

      const activeScopeSnapshot = getScopeSnapshot();
      const renderer = getActiveRenderer();
      const hArgs = /** @type {const} */ ([
        undefined,
        undefined,
        undefined,
        undefined,
        renderer,
      ]);
      const stackBefore = activeScopeSnapshot.scopes.get(Scope) ?? [];
      activeScopeSnapshot.scopes.set(Scope, [...stackBefore, props.value]);
      try {
        if ('h' in props && !props.h) {
          const template = renderFn();
          return createNodesFromTemplate(template, renderer);
        }
        return h(renderFn, {}, ...hArgs);
      } finally {
        activeScopeSnapshot.scopes.set(Scope, stackBefore);
      }
    },
  };

  /// @ts-expect-error: Vite types are not ingrained.
  if (import.meta.env?.DEV) {
    /// @ts-expect-error: Not used in production.
    Scope.Provider.__isScopeProviderOf = Scope;
  }

  return Scope;
}

/**
 * Consumes the data from a synchronous scope previously provided by `createScope`.
 * This hook retrieves the most recently provided value for a given scope.
 *
 * @template [T=unknown] The expected type of the scope data.
 * @param {Scope<T>} Scope The scope provider component returned by `createScope`.
 * @param {ScopeSnapshot} [snapshot] An optional snapshot of the current environment
 * @returns {T} The data stored in the specified scope.
 * @throws {Error} If no parent scope is found for the given provider, indicating it was not used to provide the scope.
 */
export function useScopeContext(Scope, snapshot) {
  const snapshotCtx = snapshot || getScopeSnapshot();
  const relatedScopeData = snapshotCtx.scopes.get(Scope);

  if (!relatedScopeData || relatedScopeData.length === 0) {
    // @ts-expect-error: Vite types is not ingrained.
    if (import.meta.env?.DEV) {
      // In HMR, scopes can change referential identity.
      // `HmrId` helps identify them across reloads.
      // Its not fool proof, but it works.
      const latestInstance = Reflect.get(Scope, OverwrittenBy);
      if (latestInstance && latestInstance !== Scope) {
        // Scope was previously invalidated by HMR.
        return useScopeContext(latestInstance, snapshot);
      }
      const { globalData } = getGlobalContext();
      const hmrContext = globalData.get(HMRContextKey);
      if (hmrContext) {
        const activeScopes = getHMRScopeList();
        const hmrId = Reflect.get(Scope, HmrId);
        const latestInstance = activeScopes.get(hmrId);
        if (latestInstance && latestInstance !== Scope) {
          Reflect.set(Scope, OverwrittenBy, latestInstance);
          return useScopeContext(latestInstance, snapshot);
        }
      }
    }

    const scopeName = Scope?.key.description || 'UnknownScope';
    throw new Error(
      `No parent scope found for the provided scope (${scopeName}).\nThis usually means you are calling useScopeContext outside of a <Scope.Provider> for this scope.`
    );
  }
  return /** @type {T} */ (relatedScopeData[relatedScopeData.length - 1]);
}

/**
 * Captures a snapshot of the current values of all active scopes.
 * This can be used to "save" the scope state at a particular point in time,
 * which can then be restored later using `withScopeSnapshot`.
 *
 * @returns {ScopeSnapshot} A Map where keys are scope providers and values are the
 *   currently active data for that scope.
 *
 * @example
 * ```js
 * // Assuming 'ThemeScope' is a scope created with createScope()
 * // and a value has been provided to it.
 * const initialSnapshot = createScopeSnapshot();
 *
 * // ... some operations that might push new values onto scopes ...
 *
 * // To restore the state later:
 * withScopeSnapshot(initialSnapshot, () => {
 *   // Inside this callback, the scopes are temporarily restored
 *   // to the state captured in 'initialSnapshot'.
 *   console.log('Scopes inside callback are restored to the snapshot.');
 * });
 * ```
 */
export function createScopeSnapshot() {
  const { scopes, node } = getScopeSnapshot();
  return { scopes: new Map(scopes), node: node.branch() };
}

/**
 * Returns a snapshot of the current scope state.
 *
 * @returns {ScopeSnapshot} A Map where keys are scope providers and values are the
 *   currently active data for that scope.
 */
function getScopeSnapshot() {
  const { globalData } = getGlobalContext();
  if (!globalData.has(SNAPSHOT_KEY)) {
    const node = new RootEffectNode();
    const scopes = new Map();
    globalData.set(SNAPSHOT_KEY, { scopes, node });
  }
  return globalData.get(SNAPSHOT_KEY);
}

/**
 * @param {ScopeSnapshot} snapshot
 */
function setScopeSnapshot(snapshot) {
  const { globalData } = getGlobalContext();
  globalData.set(SNAPSHOT_KEY, snapshot);
}

/**
 * Executes a callback with the application's scope state temporarily restored
 * to a previously captured snapshot.
 *
 * This function is useful for scenarios like server-side rendering or testing,
 * where you need to isolate or restore a specific set of scope values without
 * affecting the global state after the operation completes.
 *
 * @template T
 * @param {ScopeSnapshot} snapshot A `ScopeSnapshot` object, typically obtained
 *   from `createScopeSnapshot()`, representing the desired state of scopes to
 *   restore.
 * @param {() => T} callback A function to execute within the context of
 *   the restored scope snapshot. Any `useScopeContext` calls made inside this
 *   callback will return the values from the provided `snapshot`.
 *
 * @example
 * ```js
 * const ThemeScope = createScope();
 * const UserScope = createScope();
 *
 * // Assume some initial values have been provided for ThemeScope and UserScope.
 *
 * // Capture the initial state of all active scopes
 * const initialSnapshot = createScopeSnapshot();
 *
 * // Assume some operations happen that change the values in the scopes.
 *
 * // Now, restore the scopes to the 'initialSnapshot' state for a specific operation
 * withScopeSnapshot(initialSnapshot, () => {
 *   // Inside this callback, any useScopeContext calls will retrieve values
 *   // as they were when 'initialSnapshot' was captured.
 *   console.log('Theme inside callback:', useScopeContext(ThemeScope));
 *   console.log('User inside callback:', useScopeContext(UserScope));
 * });
 *
 * // After the callback finishes, the original scope state is restored.
 * ```
 */
export function withScopeSnapshot(snapshot, callback) {
  /** @type {ScopeSnapshot | null} */
  let previousSnapshot = null;

  try {
    previousSnapshot = getScopeSnapshot();
    setScopeSnapshot(snapshot);
    return Cell.runWithContext(snapshot.node.localContext, callback);
  } finally {
    if (getScopeSnapshot() === snapshot) {
      if (previousSnapshot) setScopeSnapshot(previousSnapshot);
    }
  }
}

/**
 * Combines multiple scopes into a single, composite provider component.
 * This is a utility for composing multiple contexts without manually nesting them.
 * The providers are applied from first to last, meaning the first provider
 * in the argument list will be the outermost in the component tree.
 *
 * @param {...Scope<any>} providers A sequence of scope provider components to combine.
 * @returns {Scope<any>} A new provider component that wraps the content with all given providers.
 *
 * @example
 * ```js
 * const ThemeScope = createScope();
 * const UserScope = createScope();
 *
 * // Instead of nesting providers like this:
 * <ThemeScope.Provider value='light' content={() =>
 *   <UserScope.Provider value={{ name: 'Anonymous' }} content={() => <App />} />
 * } />
 *
 * // You can combine them and use it like a single provider:
 * const AppScope = combineScopes(ThemeScope, UserScope);
 * const data = {
 *   [ThemeScope.key]: 'light',
 *   [UserScope.key]: { name: 'Anonymous' }
 * };
 * <AppScope.Provider value={data} content={App} />
 * ```
 */
export function combineScopes(...providers) {
  /** @type {Scope<any>} */
  const Scope = {
    key: Symbol('CombinedScope'),
    Provider(props) {
      const renderFn =
        'content' in props
          ? props.content
          : 'children' in props
            ? props.children
            : () => {};

      const finalContent = [...providers].reverse().reduce(
        (innerContent, Scope) => () => {
          return Scope.Provider({
            value: props.value[Scope.key],
            content: innerContent,
          });
        },
        renderFn
      );
      return finalContent();
    },
  };

  return Scope;
}

/**
 * A hook for managing side effects with cleanup, tied to a component's logical lifecycle.
 *
 * The callback runs once when a component instance is initialized, ideal for tasks
 * like setting timers, subscribing to data streams, or adding global event listeners.
 * The callback can return a cleanup function to prevent memory leaks, automatically
 * executed when the component instance is destroyed (e.g., when removed from a `<For>` list).
 *
 * @param {SetupFn} callback - Function executed once on component setup. If it returns
 *   a function, that function is used for cleanup.
 *
 * @example
 * ```tsx
 * import { Cell, useSetupEffect } from 'retend';
 *
 * function LiveClock() {
 *   const time = Cell.source(new Date());
 *   const timeStr = Cell.derived(() => {
 *     return time.get().toLocaleTimeString();
 *   });
 *
 *   useSetupEffect(() => {
 *     const timerId = setInterval(() => time.set(new Date()), 1000);
 *     return () => clearInterval(timerId);
 *   });
 *
 *   return <p>Current time: {timeStr}</p>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * useSetupEffect(() => {
 *   const handleResize = () => console.log('Window resized!');
 *   window.addEventListener('resize', handleResize);
 *
 *   return () => window.removeEventListener('resize', handleResize);
 * });
 * ```
 *
 * @remarks
 * - This hook runs only once per component instance, similar to `useEffect(..., [])` in React. It does not re-run on updates.
 * - For effects tied to a specific DOM element's presence on screen (like measuring its size), use `useObserver` instead.
 *
 * @see {@link useObserver} for DOM-based lifecycle effects.
 */
export function useSetupEffect(callback) {
  const { node } = getScopeSnapshot();
  node.add(callback);
}

/**
 * Executes all pending setup effects that have been registered via `useSetupEffect`.
 *
 * In many applications, particularly on the client-side, this function is called once
 * after the initial render to activate all registered lifecycle effects, such as
 * setting up timers, subscriptions, or event listeners. It ensures that the setup
 * logic defined in `useSetupEffect` is executed and can begin its work.
 *
 * @example
 * ```js
 * // After rendering your application to the DOM:
 * const root = document.getElementById('app');
 * root.appendChild(App());
 *
 * // Run all the setup effects that were registered during the render.
 * runPendingSetupEffects();
 * ```
 *
 * @see {@link useSetupEffect} for registering effects that will be run by this function.
 */
export async function runPendingSetupEffects() {
  const { node } = getScopeSnapshot();
  if (!(node instanceof RootEffectNode)) {
    const message =
      'runPendingSetupEffects() can only be called at the root level of a component tree.';
    throw new Error(message);
  }
  node.enable();
  await node.activate();
  await new Promise((resolve) => setTimeout(resolve));
}
