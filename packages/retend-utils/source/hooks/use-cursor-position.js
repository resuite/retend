import { Cell } from 'retend';
import { createSharedHook } from '../internal/create-shared-hook.js';

/**
 * @typedef {object} CursorPosition
 * @property {Cell<number>} x - The x coordinate of the cursor.
 * @property {Cell<number>} y - The y coordinate of the cursor.
 */

const CURSOR_POSITION_KEY = Symbol('hooks:useCursorPosition:position');

/**
 * Tracks the cursor position within the window.
 *
 * @type {() => CursorPosition}
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
export const useCursorPosition = createSharedHook({
  key: CURSOR_POSITION_KEY,
  initialData: () => ({
    cells: { x: Cell.source(0), y: Cell.source(0) },
  }),
  setup: (data, { document }) => {
    const options = { passive: true };
    data.handleMouseMove = (event) => {
      if (event instanceof MouseEvent) {
        data.cells.x.set(event.clientX);
        data.cells.y.set(event.clientY);
      }
    };
    document.addEventListener('mousemove', data.handleMouseMove, options);
    document.addEventListener('pointerdown', data.handleMouseMove, options); // touch screen compat.
  },
  teardown: (data, { document }) => {
    document.removeEventListener('mousemove', data.handleMouseMove);
    document.removeEventListener('pointerdown', data.handleMouseMove);
  },
  getValue: (data) => ({
    x: Cell.derived(() => data.cells.x.get()),
    y: Cell.derived(() => data.cells.y.get()),
  }),
});
