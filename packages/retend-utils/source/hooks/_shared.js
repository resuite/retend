/** @import { Environments, GlobalContextChangeEvent } from 'retend/context' */
import { getGlobalContext, matchContext, Modes } from 'retend/context';

/**
 * @template {Array<any>} TParams, TState, [TReturnValue=TState]
 * @typedef {object} CreateGlobalStateHookOptions
 * @property {string | symbol} cacheKey - Unique key for caching state in globalData.
 * @property {(...params: TParams) => TState} createSource - Function to create the initial source cells.
 * @property {(window: Window, cells: TState, ...params: TParams) => void} setupListeners - Function to attach event listeners to update cells.
 * @property {(cells: TState, ...params: TParams) => TReturnValue} createReturnValue - Function to format the hook's return value from source cells.
 * @property {(window: Window, cells: TState,...params: TParams) => void} [initializeState] - Optional function to set the initial state based on the window object.
 */

/**
 * Factory function to create hooks that manage global state tied to the window object.
 * Handles context switching, caching, and listener setup.
 *
 * @template {Array<any>} TParams The type of the parameters passed to the hook.
 * @template TState The type of the state object managed by the hook (e.g., { width: SourceCell<number>, height: SourceCell<number> } or { isOnlineSource: SourceCell<boolean> }).
 * @template TReturnValue The type of the value returned by the hook (e.g., { width: Cell<number>, height: Cell<number> } or Cell<boolean>).
 * @param {CreateGlobalStateHookOptions<TParams, TState, TReturnValue>} options - Configuration for the specific hook.
 * @returns {(...params: TParams) => TReturnValue} The created hook function.
 */
export function createGlobalStateHook(options) {
  const {
    cacheKey,
    createSource: createSourceCells,
    setupListeners,
    createReturnValue,
    initializeState,
  } = options;

  /** @param {TParams} params */
  return function useGlobalStateHook(...params) {
    const initialContext = getGlobalContext();
    const { globalData, window } = initialContext;

    /** @type {TState} */
    let stateCells;
    if (globalData.has(cacheKey)) {
      stateCells = globalData.get(cacheKey);
      return createReturnValue(stateCells, ...params);
    }

    stateCells = createSourceCells(...params);

    if (matchContext(window, Modes.VDom)) {
      /** @param {GlobalContextChangeEvent} event */
      const changeContext = (event) => {
        const { newContext } = event.detail;
        if (
          newContext?.window &&
          matchContext(newContext.window, Modes.Interactive)
        ) {
          trackInContext(stateCells, newContext, params);
          // @ts-ignore: Custom events are not properly typed in JS.
          window.removeEventListener('globalcontextchange', changeContext);
        }
      };
      // @ts-ignore: Custom events are not properly typed in JS.
      window.addEventListener('globalcontextchange', changeContext);
    }

    trackInContext(stateCells, initialContext, params);
    return createReturnValue(stateCells, ...params);
  };

  /**
   * Sets up tracking and listeners within a specific context.
   * @param {TState} stateCells
   * @param {Environments} context
   * @param {TParams} params
   */
  function trackInContext(stateCells, context, params) {
    const { globalData, window } = context;

    // Don't setup listeners or initialize state in VDom context
    if (matchContext(window, Modes.VDom)) {
      // Still cache the cells so they are available when context changes
      globalData.set(cacheKey, stateCells);
      return;
    }

    // Initialize state if function provided
    if (initializeState) {
      initializeState(window, stateCells, ...params);
    }

    // Cache the state cells
    globalData.set(cacheKey, stateCells);

    // Setup event listeners
    setupListeners(window, stateCells, ...params);
  }
}
