/** @import { SourceCell } from 'retend' */
/** @import { CreateGlobalStateHookOptions } from './_shared.js' */

import { Cell } from 'retend';
import { createGlobalStateHook } from './_shared.js';

/**
 * @typedef {object} WindowSizeState
 * @property {SourceCell<number>} width
 * @property {SourceCell<number>} height
 */

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
export const useWindowSize = createGlobalStateHook(
  /** @type {CreateGlobalStateHookOptions<[], WindowSizeState, ReactiveWindowSize>} */
  ({
    cacheKey: USE_WINDOW_SIZE_KEY,

    createSource: () => ({
      width: Cell.source(0),
      height: Cell.source(0),
    }),

    initializeState: (window, cells) => {
      cells.width.value = window.innerWidth;
      cells.height.value = window.innerHeight;
    },

    setupListeners: (window, cells) => {
      window.addEventListener('resize', () => {
        cells.width.value = window.innerWidth;
        cells.height.value = window.innerHeight;
      });
    },

    createReturnValue: (cells) => ({
      width: Cell.derived(() => cells.width.value),
      height: Cell.derived(() => cells.height.value),
    }),
  })
);
