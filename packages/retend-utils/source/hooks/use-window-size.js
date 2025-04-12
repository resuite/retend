import { Cell } from 'retend';
import { getGlobalContext } from 'retend/context';

/**
 * @typedef {object} ReactiveWindowSize
 * @property {Cell<number>} width
 * @property {Cell<number>} height
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
  const { window, globalData } = getGlobalContext();

  /** @type {{ width: import('retend').SourceCell<number>, height: import('retend').SourceCell<number> }} */
  const windowSize = globalData.get(USE_WINDOW_SIZE_KEY) ?? {
    width: Cell.source(window.innerWidth),
    height: Cell.source(window.innerHeight),
  };
  globalData.set(USE_WINDOW_SIZE_KEY, windowSize);

  window.addEventListener('resize', () => {
    windowSize.width.value = window.innerWidth;
    windowSize.height.value = window.innerHeight;
  });

  return {
    // Derived so that listens don't lead to memory leaks.
    width: Cell.derived(() => windowSize.width.value),
    height: Cell.derived(() => windowSize.height.value),
  };
}
