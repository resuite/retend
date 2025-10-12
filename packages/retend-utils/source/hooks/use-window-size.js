import { Cell } from 'retend';
import { createSharedHook } from '../internal/create-shared-hook.js';
import { getGlobalContext } from 'retend/context';

/**
 * @typedef {object} WindowSize
 * @property {Cell<number>} width
 * @property {Cell<number>} height
 */

const USE_WINDOW_SIZE_KEY = Symbol('hooks:useWindowSize:windowSizeCache');

/**
 * Returns an object containing cells that track the current window size.
 *
 * @type {() => WindowSize}
 * @returns {WindowSize} An object with two properties:
 *
 * @example
 * import { useWindowSize } from 'retend-utils/hooks';
 *
 * // Get the current window size
 * const { width, height } = useWindowSize();
 *
 * // Access the current width and height values
 * console.log(`Window width: ${width.get()}px`);
 * console.log(`Window height: ${height.get()}px`);
 *
 * // React to changes in window size
 * width.listen(newWidth => {
 *   console.log(`Window width changed to: ${newWidth}px`);
 * });
 */
export const useWindowSize = createSharedHook({
  key: USE_WINDOW_SIZE_KEY,

  initialData: () => {
    const { window } = getGlobalContext();
    return {
      cells: {
        width: Cell.source(window.innerWidth),
        height: Cell.source(window.innerHeight),
      },
    };
  },

  setup: (data, { window }) => {
    const handleResize = () => {
      Cell.batch(() => {
        data.cells.width.set(window.innerWidth);
        data.cells.height.set(window.innerHeight);
      });
    };
    handleResize();
    data.handleResize = handleResize;
    window.addEventListener('resize', data.handleResize);
  },

  teardown: (data, { window }) => {
    window.removeEventListener('resize', data.handleResize);
  },

  getValue: (data) => ({
    width: Cell.derived(() => data.cells.width.get()),
    height: Cell.derived(() => data.cells.height.get()),
  }),
});
