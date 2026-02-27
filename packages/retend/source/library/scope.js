/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { onConnected, CleanupFn } from './observer.js' */
/** @import { Renderer } from './renderer.js'; */
import { Cell } from '@adbl/cells';

import { getGlobalContext } from '../context/index.js';
import { getActiveRenderer, setActiveRenderer } from './renderer.js';
import { createNodesFromTemplate, normalizeJsxChild } from './utils.js';

/** @import { SourceCell } from "@adbl/cells"; */

/** @typedef {{
 *    [ComponentInvalidator]?: Cell<Function & __HMR_UpdatableFn>
 *    __isScopeProviderOf?: Scope
 * } & Function} __HMR_UpdatableFn
 */

/**
 * @typedef HmrContext
 * @property {Array<unknown>} old
 * @property {Array<unknown>} new
 * @property {SourceCell<Function | null>} current
 */

/**
 * @template [T=unknown]
 * @typedef ScopePropsWithChildren
 * @property {JSX.Template} children
 * @property {T} value
 */

/**
 * @template [T=unknown]
 * @typedef {ScopePropsWithChildren<T>} ScopeProps
 */

/**
 * @template [T=any]
 * @typedef Scope
 * @property {symbol} key
 * @property {(props: ScopeProps<T>) => JSX.Template} Provider
 */

/**
 * @typedef ScopeLink
 * @property {Scope} scope
 * @property {any} value
 * @property {ScopeLink | null} parent
 */

/**
 * @typedef StateSnapshot
 * @property {ScopeLink | null} scopes
 * @property {EffectNode} node
 * @property {Renderer<any> | undefined} renderer
 * @property {any} [data]
 */

/**
 * @typedef {(() => CleanupFn | undefined) | (() => Promise<CleanupFn | undefined>) | (() => void | Promise<void>) } SetupFn
 */

/**
 * Represents a node managing effects and cleanup within a hierarchy.
 * Allows enabling/disabling, forking child nodes, and disposing by cleaning effects and children.
 */
class EffectNode {
  #id = '0';

  /** @type {Array<SetupFn>} */
  #setupFns = [];
  /** @type {Array<() => (Promise<void> | void)>} */
  #disposeFns = [];
  /** @type {Array<EffectNode>} */
  #children = [];

  #enabled = false;
  #suspended = false;
  #active = false;
  localContext = Cell.context();
  /** @type {Renderer<any>} | undefined */
  renderer = getActiveRenderer();

  /** The hierarchical ID of this node (e.g., "0.1.2") */
  get id() {
    return this.#id;
  }

  enable() {
    if (this.renderer?.capabilities.supportsSetupEffects) {
      this.#enabled = true;
      for (const child of this.#children) {
        if (!child.#suspended) child.enable();
      }
    }
  }

  suspend() {
    this.#suspended = true;
  }

  unsuspend() {
    this.#suspended = false;
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
    newNode.#id = `${this.#id}.${this.#children.length}`;
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
    await new Promise((resolve) => setTimeout(resolve));
    await this.#runActivateFns();
    this.renderer?.host.dispatchEvent(new Event('retend:activate'));
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
    if (!this.renderer?.capabilities.supportsSetupEffects) {
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

    if (!this.renderer?.capabilities.supportsSetupEffects) {
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
 *    return (
 *      <UserInfoScope.Provider value={userInfo}>
 *        <ChildComponent />
 *      </UserInfoScope.Provider>
 *    );
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
      const renderFn = 'children' in props ? props.children : () => {};

      const activeStateSnapshot = getState();
      const renderer = getActiveRenderer();
      const previousScopes = activeStateSnapshot.scopes;
      activeStateSnapshot.scopes = {
        scope: Scope,
        value: props.value,
        parent: previousScopes,
      };
      try {
        if ('h' in props && !props.h) {
          return createNodesFromTemplate(renderFn, renderer);
        }
        return normalizeJsxChild(renderFn, renderer);
      } finally {
        activeStateSnapshot.scopes = previousScopes;
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
 * @returns {T} The data stored in the specified scope.
 * @throws {Error} If no parent scope is found for the given provider, indicating it was not used to provide the scope.
 */
export function useScopeContext(Scope) {
  const snapshotCtx = getState();
  let relatedScopeData;
  let link = snapshotCtx.scopes;
  while (link) {
    if (link.scope === Scope) {
      relatedScopeData = link.value;
      break;
    }
    link = link.parent;
  }

  if (!relatedScopeData) {
    // @ts-expect-error: Vite types is not ingrained.
    if (import.meta.env?.DEV) {
      // In HMR, scopes can change referential identity.
      // `HmrId` helps identify them across reloads.
      // Its not fool proof, but it works.
      const latestInstance = Reflect.get(Scope, __HMR_SYMBOLS.OverwrittenBy);
      if (latestInstance && latestInstance !== Scope) {
        // Scope was previously invalidated by HMR.
        return useScopeContext(latestInstance);
      }
      const { globalData } = getGlobalContext();
      const hmrContext = globalData.get(__HMR_SYMBOLS.HMRContextKey);
      if (hmrContext) {
        const activeScopes = __HMR_SYMBOLS.ScopeList;
        const hmrId = Reflect.get(Scope, __HMR_SYMBOLS.HmrId);
        const latestInstance = activeScopes.get(hmrId);
        if (latestInstance && latestInstance !== Scope) {
          Reflect.set(Scope, __HMR_SYMBOLS.OverwrittenBy, latestInstance);
          return useScopeContext(latestInstance);
        }
      }
    }

    const scopeName = Scope?.key.description || 'UnknownScope';
    throw new Error(
      `No parent scope found for the provided scope (${scopeName}).\nThis usually means you are calling useScopeContext outside of a <Scope.Provider> for this scope.`
    );
  }
  return /** @type {T} */ relatedScopeData;
}

/**
 * Creates a new branch of the active application state, inheriting the
 * current values of all active scopes and appending a new
 * effect lifecycle node to the currently active node tree.
 *
 * This function is used to create an isolated execution branch for components,
 * which can then be resumed or isolated using `withState`. Because
 * this eagerly branches the effect lifecycle tree, the newly created nodes
 * should eventually be activated or disposed to avoid memory leaks.
 *
 * @returns {StateSnapshot} A state branch containing the current scope chain and a newly forked effect node.
 *
 * @example
 * ```js
 * // Assuming 'ThemeScope' is a scope created with createScope()
 * // and a value has been provided to it.
 * const initialSnapshot = branchState();
 *
 * // ... some operations that might push new values onto scopes ...
 *
 * // To restore the state later:
 * withState(initialSnapshot, () => {
 *   // Inside this callback, the scopes are temporarily restored
 *   // to the state captured in 'initialSnapshot'.
 *   console.log('Scopes inside callback are restored to the snapshot.');
 * });
 * ```
 */
export function branchState() {
  const { scopes, node } = getState();
  const branched = node.branch();
  return {
    scopes,
    node: branched,
    renderer: getActiveRenderer(),
  };
}

/**
 * Returns the current scope state.
 *
 * @returns {StateSnapshot} A snapshot containing the current scope chain and effect node.
 */
export function getState() {
  const { globalData } = getGlobalContext();
  if (!globalData.has(SNAPSHOT_KEY)) {
    const node = new RootEffectNode();
    const renderer = getActiveRenderer();
    globalData.set(SNAPSHOT_KEY, { scopes: null, node, renderer });
  }
  const snapshot = globalData.get(SNAPSHOT_KEY);
  return snapshot;
}

/**
 * @param {StateSnapshot} snapshot
 */
function setState(snapshot) {
  const { globalData } = getGlobalContext();
  globalData.set(SNAPSHOT_KEY, snapshot);
}

/**
 * Executes a callback within a previously created state branch.
 *
 * This function is useful for scenarios like component rendering,
 * server-side rendering or testing, where you need to isolate or run
 * within a specific set of scope values and their effect lifecycles without
 * affecting the global active execution branch after the operation completes.
 *
 * @template T
 * @param {StateSnapshot} snapshot A `StateSnapshot` object, typically obtained
 *   from `branchState()`, representing the desired state branch to
 *   execute within.
 * @param {() => T} callback A function to execute within the context of
 *   the restored scope branch. Any `useScopeContext` calls made inside this
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
 * const initialSnapshot = branchState();
 *
 * // Assume some operations happen that change the values in the scopes.
 *
 * // Now, restore the scopes to the 'initialSnapshot' state for a specific operation
 * withState(initialSnapshot, () => {
 *   // Inside this callback, any useScopeContext calls will retrieve values
 *   // as they were when 'initialSnapshot' was captured.
 *   console.log('Theme inside callback:', useScopeContext(ThemeScope));
 *   console.log('User inside callback:', useScopeContext(UserScope));
 * });
 *
 * // After the callback finishes, the original scope state is restored.
 * ```
 */
export function withState(snapshot, callback) {
  /** @type {StateSnapshot | null} */
  let previousSnapshot = null;
  const previousRenderer = getActiveRenderer();

  try {
    previousSnapshot = getState();
    setState(snapshot);
    if (snapshot.renderer) {
      setActiveRenderer(snapshot.renderer);
    }
    return Cell.runWithContext(snapshot.node.localContext, callback);
  } finally {
    setActiveRenderer(previousRenderer);
    if (previousSnapshot) setState(previousSnapshot);
  }
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
 * import { Cell, onSetup } from 'retend';
 *
 * function LiveClock() {
 *   const time = Cell.source(new Date());
 *   const timeStr = Cell.derived(() => {
 *     return time.get().toLocaleTimeString();
 *   });
 *
 *   onSetup(() => {
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
 * onSetup(() => {
 *   const handleResize = () => console.log('Window resized!');
 *   window.addEventListener('resize', handleResize);
 *
 *   return () => window.removeEventListener('resize', handleResize);
 * });
 * ```
 *
 * @remarks
 * - This hook runs only once per component instance, similar to `useEffect(..., [])` in React. It does not re-run on updates.
 * - For effects tied to a specific DOM element's presence on screen (like measuring its size), use `onConnected` instead.
 *
 * @see {@link onSetup} for registering effects that will be run by this function.
 * @see {@link onConnected} for DOM-based lifecycle effects.
 */
export function onSetup(callback) {
  const { node } = getState();
  node.add(callback);
}

/**
 * Executes all pending setup effects that have been registered via `onSetup`.
 *
 * In many applications, particularly on the client-side, this function is called once
 * after the initial render to activate all registered lifecycle effects, such as
 * setting up timers, subscriptions, or event listeners. It ensures that the setup
 * logic defined in `onSetup` is executed and can begin its work.
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
 * @see {@link onSetup} for registering effects that will be run by this function.
 */
export async function runPendingSetupEffects() {
  const { node } = getState();
  if (!(node instanceof RootEffectNode)) {
    const message =
      'runPendingSetupEffects() can only be called at the root level of a component tree.';
    throw new Error(message);
  }
  node.enable();
  await node.activate();
  await new Promise((resolve) => setTimeout(resolve));
}

/** @type {Scope<__HMR_UpdatableFn[]>} */
const RetendComponentTree = createScope('retend:RetendComponentTree');
const ComponentInvalidator = Symbol('Invalidator');

export const __HMR_SYMBOLS = {
  ComponentInvalidator,
  OverwrittenBy: Symbol('OverwrittenBy'),
  HmrId: Symbol('HmrId'),
  HMRContextKey: Symbol('HMRContext'),
  HMRScopeContext: Symbol('HMRScopeContext'),
  ScopeList: new Map(),
  RetendComponentTree,
  useComponentAncestry() {
    try {
      return useScopeContext(RetendComponentTree);
    } catch {
      return [];
    }
  },
  /** @returns {HmrContext | null} */
  getHMRContext() {
    const { globalData } = getGlobalContext();
    return globalData.get(__HMR_SYMBOLS.HMRContextKey);
  },
};
