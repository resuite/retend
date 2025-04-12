import { Cell } from 'retend';
import { getGlobalContext } from 'retend/context';

/**
 * @typedef {object} ReactiveWindowSize
 * @property {Cell<number>} width
 * @property {Cell<number>} height
 */

/**
 * Returns an object containing cells that track the current window size.
 *
 * @returns {ReactiveWindowSize} An object with two properties:
 *   - width: A Cell containing the current window width
 *   - height: A Cell containing the current window height
 *
 * @example
 * import { useWindowSize } from 'retend-utils/use-window-size';
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
  let windowSize;
  const windowSizeListenerAdded = globalData.has('hooks:windowSizeInitialized');
  if (globalData.has('hooks:windowSizeCache')) {
    windowSize = globalData.get('hooks:windowSizeCache');
  } else {
    windowSize = { width: Cell.source(0), height: Cell.source(0) };
    globalData.set('hooks:windowSizeCache', windowSize);
  }

  if (!windowSizeListenerAdded) {
    windowSize.width.value = window.innerWidth;
    windowSize.height.value = window.innerHeight;

    window.addEventListener('resize', () => {
      windowSize.width.value = window.innerWidth;
      windowSize.height.value = window.innerHeight;
    });
    globalData.set('hooks:windowSizeInitialized', true);
  }
  return {
    // Derived so that listens don't lead to memory leaks.
    width: Cell.derived(() => windowSize.width.value),
    height: Cell.derived(() => windowSize.height.value),
  };
}
