/** @import { Environments, GlobalContextChangeEvent } from 'retend/context' */
import { getGlobalContext, matchContext, Modes } from 'retend/context';

/**
 * @template TState, TReturnValue
 * @typedef {object} CreateGlobalStateHookOptions
 * @property {string} cacheKey - Unique key for caching state in globalData.
 * @property {() => TState} createSourceCells - Function to create the initial source cells.
 * @property {(window: Window, cells: TState) => void} setupListeners - Function to attach event listeners to update cells.
 * @property {(cells: TState) => TReturnValue} createReturnValue - Function to format the hook's return value from source cells.
 * @property {(window: Window, cells: TState) => void} [initializeState] - Optional function to set the initial state based on the window object.
 */

/**
 * Factory function to create hooks that manage global state tied to the window object.
 * Handles context switching, caching, and listener setup.
 *
 * @template TState The type of the state object managed by the hook (e.g., { width: SourceCell<number>, height: SourceCell<number> } or { isOnlineSource: SourceCell<boolean> }).
 * @template TReturnValue The type of the value returned by the hook (e.g., { width: Cell<number>, height: Cell<number> } or Cell<boolean>).
 * @param {CreateGlobalStateHookOptions<TState, TReturnValue>} options - Configuration for the specific hook.
 * @returns {() => TReturnValue} The created hook function.
 */
export function createGlobalStateHook(options) {
  const {
    cacheKey,
    createSourceCells,
    setupListeners,
    createReturnValue,
    initializeState,
  } = options;

  return function useGlobalStateHook() {
    const initialContext = getGlobalContext();
    const { globalData, window } = initialContext;

    /** @type {TState} */
    let stateCells;
    if (globalData.has(cacheKey)) {
      stateCells = globalData.get(cacheKey);
      return createReturnValue(stateCells);
    }

    stateCells = createSourceCells();

    if (matchContext(window, Modes.VDom)) {
      /** @param {GlobalContextChangeEvent} event */
      const changeContext = (event) => {
        const { newContext } = event.detail;
        if (
          newContext?.window &&
          matchContext(newContext.window, Modes.Interactive)
        ) {
          trackInContext(stateCells, newContext);
          // @ts-ignore: Custom events are not properly typed in JS.
          window.removeEventListener('globalcontextchange', changeContext);
        }
      };
      // @ts-ignore: Custom events are not properly typed in JS.
      window.addEventListener('globalcontextchange', changeContext);
    }

    trackInContext(stateCells, initialContext);
    return createReturnValue(stateCells);
  };

  /**
   * Sets up tracking and listeners within a specific context.
   * @param {TState} stateCells
   * @param {Environments} context
   */
  function trackInContext(stateCells, context) {
    const { globalData, window } = context;

    // Don't setup listeners or initialize state in VDom context
    if (matchContext(window, Modes.VDom)) {
      // Still cache the cells so they are available when context changes
      globalData.set(cacheKey, stateCells);
      return;
    }

    // Initialize state if function provided
    if (initializeState) {
      initializeState(window, stateCells);
    }

    // Cache the state cells
    globalData.set(cacheKey, stateCells);

    // Setup event listeners
    setupListeners(window, stateCells);
  }
}
