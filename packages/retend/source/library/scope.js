/** @import { JSX } from '../jsx-runtime/types.ts' */

import { getGlobalContext } from "../context/index.js";
import h from "./jsx.js";

/**
 * @template [T=unknown]
 * @typedef ScopeProps
 * @property {() => JSX.Template} content
 * @property {T} value
 */

/**
 * @template [T=any]
 * @typedef Scope
 * @property {symbol} key
 * @property {(props: ScopeProps<T>) => JSX.Template} Provider
 */

/**
 * @typedef {Map<Scope, unknown[]>} ScopeSnapshot
 */

const SNAPSHOT_KEY = Symbol("__ACTIVE_SCOPE_SNAPSHOT__");

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
    key: Symbol(name ?? "Scope"),
    Provider: (props) => {
      const activeScopeSnapshot = getScopeSnapshot();
      const stackBefore = activeScopeSnapshot.get(Scope) ?? [];
      activeScopeSnapshot.set(Scope, [...stackBefore, props.value]);
      try {
        return h(props.content, {});
      } finally {
        activeScopeSnapshot.set(Scope, stackBefore);
      }
    },
  };

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
  const relatedScopeData = snapshotCtx.get(Scope);
  if (!relatedScopeData || relatedScopeData.length === 0) {
    throw new Error(`No parent scope found for the provided scope.`);
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
  return new Map(getScopeSnapshot());
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
    globalData.set(SNAPSHOT_KEY, new Map());
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
    previousSnapshot = createScopeSnapshot();
    setScopeSnapshot(snapshot);
    return callback();
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
    key: Symbol("CombinedScope"),
    Provider(props) {
      const finalContent = [...providers].reverse().reduce(
        (innerContent, Scope) => () =>
          Scope.Provider({
            value: props.value[Scope.key],
            content: innerContent,
          }),
        props.content,
      );
      return finalContent();
    },
  };

  return Scope;
}
