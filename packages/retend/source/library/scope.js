/** @import { JSX } from '../jsx-runtime/types.ts' */

/**
 * @typedef ProviderProps
 * @property {() => JSX.Template} content
 */

/**
 * @typedef {(props: ProviderProps) => JSX.Template} ScopeProvider
 * @typedef {Map<PropertyKey, unknown>} ScopeSnapshot
 */

/** @type {Map<PropertyKey, unknown[]>} */
const SCOPE_REGISTRY = new Map();

/**
 * Creates a synchronous scope that can be provided and consumed within a component tree.
 * This allows for passing data down through components without explicit prop drilling.
 *
 * @template T The type of the data held by the scope.
 * @param {PropertyKey} id A unique identifier for the scope. This should be a Symbol or a string to prevent collisions.
 * @param {T} data The initial data to be stored in the scope.
 * @returns {ScopeProvider} An object containing the data and a `Provider` component.
 *
 * @example
 * ```js
 * const userInfoScopeKey = Symbol('MyScope')
 *
 * function App() {
 *    const userInfo = { name: 'Alice' };
 *    const Scope = createScope(userInfoScopeKey, userInfo)
 *    return <Scope content={ChildComponent} />
 * }
 *
 * function ChildComponent() {
 *    const user = useScope(userInfoScopeKey)
 *    return <p>User: {user.name}</p>
 * }
 * ```
 */
export function createScope(id, data) {
  const relatedScopeStack = SCOPE_REGISTRY.get(id) || [];
  SCOPE_REGISTRY.set(id, relatedScopeStack);

  /** @param {ProviderProps} props */
  const Provider = (props) => {
    try {
      relatedScopeStack.push(data);
      return props.content();
    } finally {
      relatedScopeStack.pop();
    }
  };

  return Provider;
}

/**
 * Consumes the data from a synchronous scope previously provided by `createScope`.
 * This hook retrieves the most recently provided value for a given scope ID.
 *
 * @template T The expected type of the scope data.
 * @param {PropertyKey} id The unique identifier of the scope to consume. This must match the `id` used in `createScope`.
 * @returns {T} The data stored in the specified scope.
 * @throws {Error} If no parent scope is found for the given symbol, indicating `createScope` was not used to provide the scope.
 */
export function useScope(id) {
  const relatedScopeStack = SCOPE_REGISTRY.get(id);
  if (!relatedScopeStack) {
    throw new Error(`No parent scope found for symbol.`);
  }
  return /** @type {T} */ (relatedScopeStack[relatedScopeStack.length - 1]);
}

/**
 * Captures a snapshot of the current values of all active scopes.
 * This can be used to "save" the scope state at a particular point in time,
 * which can then be restored later using `withScopeSnapshot`.
 *
 * @returns {ScopeSnapshot} A Map where keys are scope IDs and values are the
 *   currently active data for that scope.
 *
 * @example
 * ```js
 * // Assuming 'myScope' is a scope created with createScope
 * // and some value has been provided to it
 *
 * const initialSnapshot = getScopeSnapshot();
 *
 * // ... some operations that might push new values onto scopes ...
 *
 * // To restore the state later:
 * withScopeSnapshot(initialSnapshot, () => {
 *   // Inside this callback, the scopes are temporarily restored
 *   // to the state captured in 'initialSnapshot'.
 *   // After the callback completes, the original scope state is restored.
 *   console.log('Scopes inside callback are restored to the snapshot.');
 * });
 * ```
 */
export function getScopeSnapshot() {
  const scopeSnapshot = new Map();
  for (const [id, stack] of SCOPE_REGISTRY) {
    // Only capture scopes that actually have data provided
    if (stack.length > 0) {
      scopeSnapshot.set(id, stack[stack.length - 1]);
    }
  }
  return scopeSnapshot;
}

/**
 * Executes a callback with the application's scope state temporarily restored
 * to a previously captured snapshot.
 *
 * This function is useful for scenarios like server-side rendering or testing,
 * where you need to isolate or restore a specific set of scope values without
 * affecting the global state after the operation completes.
 *
 * @param {ScopeSnapshot} snapshot A `ScopeSnapshot` object, typically obtained
 *   from `getScopeSnapshot()`, representing the desired state of scopes to
 *   restore.
 * @param {() => void} callback A function to execute within the context of
 *   the restored scope snapshot. Any `useScope` calls made inside this
 *   callback will return the values from the provided `snapshot` for the
 *   relevant scope IDs.
 *
 * @example
 * ```js
 * // Assuming 'myThemeScope' and 'currentUserScope' are scopes
 * // created with createScope, and some values have been provided.
 *
 * // Capture the initial state of all active scopes
 * const initialSnapshot = getScopeSnapshot();
 *
 * // Simulate some operations that change scope values
 * // e.g., createScope(myThemeScopeKey, 'dark');
 * // e.g., createScope(currentUserScopeKey, { name: 'Bob' });
 *
 * // Now, restore the scopes to the 'initialSnapshot' state for a specific operation
 * withScopeSnapshot(initialSnapshot, () => {
 *   // Inside this callback, any useScope calls will retrieve values
 *   // as they were when 'initialSnapshot' was captured.
 *   console.log('Theme inside callback:', useScope(myThemeScopeKey)); // Will be the initial theme
 *   console.log('User inside callback:', useScope(currentUserScopeKey)); // Will be the initial user
 * });
 *
 * // After the callback finishes, the original scope state (from before withScopeSnapshot was called)
 * // is automatically restored, ensuring no side effects outside the callback.
 * console.log('Theme after callback:', useScope(myThemeScopeKey)); // Will be 'dark'
 * console.log('User after callback:', useScope(currentUserScopeKey)); // Will be { name: 'Bob' }
 * ```
 */
export function withScopeSnapshot(snapshot, callback) {
  for (const [id, data] of snapshot) {
    const relatedScopeStack = SCOPE_REGISTRY.get(id) || [];
    SCOPE_REGISTRY.set(id, relatedScopeStack);
    relatedScopeStack.push(data);
  }
  try {
    callback();
  } finally {
    for (const id of snapshot.keys()) {
      const relatedScopeStack = SCOPE_REGISTRY.get(id);
      if (relatedScopeStack) {
        relatedScopeStack.pop();
      }
    }
  }
}

/**
 * Combines multiple scope providers into a single, composite provider component.
 * This is a utility for composing multiple contexts without manually nesting them.
 * The providers are applied from first to last, meaning the first provider
 * in the argument list will be the outermost in the component tree.
 *
 * @param {...ScopeProvider} providers A sequence of scope provider components to combine.
 * @returns {ScopeProvider} A new provider component that wraps the content with all given providers.
 *
 * @example
 * ```js
 * const ThemeProvider = createScope(themeKey, 'light');
 * const UserProvider = createScope(userKey, { name: 'Anonymous' });
 *
 * // Instead of nesting providers like this:
 * // <ThemeProvider content={() =>
 * //   <UserProvider content={() => <App />} />
 * // } />
 *
 * // You can combine them:
 * const AppProviders = combineScopeProviders(ThemeProvider, UserProvider);
 *
 * // And use it like a single provider:
 * // <AppProviders content={() => <App />} />
 * ```
 */
export function combineScopeProviders(...providers) {
  /**
   * @param {ProviderProps} props
   * @returns {JSX.Template}
   */
  return function CombinedProvider(props) {
    return providers.reduceRight(
      (children, providerComponent) =>
        providerComponent({ content: () => children }),
      props.content(),
    );
  };
}
