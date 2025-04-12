/** @import { GlobalContextChangeEvent, Environments } from 'retend/context' */
/** @import { SourceCell } from 'retend' */

import { Cell } from 'retend';
import { getGlobalContext, matchContext, Modes } from 'retend/context';

/**
 * @typedef {object} ReactiveWindowSize
 * @property {Cell<number>} width
 * @property {Cell<number>} height
 */

/**
 * @typedef {object} WindowSize
 * @property {SourceCell<number>} width
 * @property {SourceCell<number>} height
 */

const USE_WINDOW_SIZE_KEY = 'hooks:useWindowSize:windowSizeCache';

/**
 * Returns an object containing cells that track the current window size.
 *
 * @returns {ReactiveWindowSize} An object with two properties:
 *   - width: A Cell containing the current window width
 *   - height: A Cell containing the current window height
 *
 * @example
 * import { useWindowSize } from 'retend-utils/hooks';
 *
 * // Get the current window size
 * const { width, height } = useWindowSize();
 *
 * // Access the current width and height values
 * console.log(`Window width: ${width.value}px`);
 * console.log(`Window height: ${height.value}px`);
 *
 * // React to changes in window size
 * width.listen(newWidth => {
 *   console.log(`Window width changed to: ${newWidth}px`);
 * });
 */
export function useWindowSize() {
  const context = getGlobalContext();
  const { globalData, window } = context;

  /** @type {WindowSize} */
  let windowSize;
  if (globalData.has(USE_WINDOW_SIZE_KEY)) {
    windowSize = globalData.get(USE_WINDOW_SIZE_KEY);
    return {
      // Derived so that listens don't lead to memory leaks.
      width: Cell.derived(() => windowSize.width.value),
      height: Cell.derived(() => windowSize.height.value),
    };
  }

  if (matchContext(window, Modes.VDom)) {
    /** @param {GlobalContextChangeEvent} event */
    const changeContext = (event) => {
      const { newContext } = event.detail;
      if (
        newContext?.window &&
        matchContext(newContext.window, Modes.Interactive)
      ) {
        trackInContext(windowSize, newContext);
        // @ts-ignore: Custom events are not properly typed in JS.
        window.removeEventListener('globalcontextchange', changeContext);
      }
    };

    // @ts-ignore: Custom events are not properly typed in JS.
    window.addEventListener('globalcontextchange', changeContext);
  }

  windowSize = {
    width: Cell.source(window.innerWidth),
    height: Cell.source(window.innerHeight),
  };
  trackInContext(windowSize, context);
  return {
    // Derived so that listen() calls don't lead to memory leaks.
    width: Cell.derived(() => windowSize.width.value),
    height: Cell.derived(() => windowSize.height.value),
  };
}

/**
 *
 * @param {WindowSize} windowSize
 * @param {Environments} context
 */
function trackInContext(windowSize, context) {
  const { globalData, window } = context;
  windowSize.width.value = window.innerWidth;
  windowSize.height.value = window.innerHeight;

  globalData.set(USE_WINDOW_SIZE_KEY, windowSize);

  window.addEventListener('resize', () => {
    windowSize.width.value = window.innerWidth;
    windowSize.height.value = window.innerHeight;
  });
}
