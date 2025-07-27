import { Cell } from 'retend';
import { createGlobalStateHook } from './_shared.js';

/**
 * @typedef {object} CursorPosition
 * @property {Cell<number>} x - The x coordinate of the cursor.
 * @property {Cell<number>} y - The y coordinate of the cursor.
 */

const CURSOR_POSITION_KEY = Symbol('hooks:useCursorPosition:position');

/**
 * Tracks the cursor position within the window.
 *
 * @returns {CursorPosition} An object containing reactive cells for the x and y coordinates of the cursor.
 *
 * @example
 * import { useCursorPosition } from 'retend-utils/hooks';
 *
 * function MyComponent() {
 *   const { x, y } = useCursorPosition();
 *
 *   return (
 *     <div>
 *       Cursor Position: X: {x}, Y: {y}
 *     </div>
 *   );
 * }
 */
export const useCursorPosition = createGlobalStateHook({
  cacheKey: CURSOR_POSITION_KEY,
  createSource: () => ({ x: Cell.source(0), y: Cell.source(0) }),
  setupListeners: (window, cells) => {
    /**
     * @param {MouseEvent} event
     */
    const updatePosition = (event) => {
      cells.x.set(event.clientX);
      cells.y.set(event.clientY);
    };
    window.addEventListener('mousemove', updatePosition, { passive: true });
  },
  /** @returns {CursorPosition}*/
  createReturnValue: (cells) => ({
    x: Cell.derived(() => cells.x.get()),
    y: Cell.derived(() => cells.y.get()),
  }),
});
