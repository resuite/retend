import { Cell } from 'retend';
import { createSharedHook } from '../internal/create-shared-hook.js';

/**
 * @typedef {object} ClickCoordinates
 * @property {Cell<number>} x - The x coordinate of the last click.
 * @property {Cell<number>} y - The y coordinate of the last click.
 */

const CLICK_COORDINATES_KEY = Symbol('hooks:useClickCoordinates:position');

/**
 * Tracks the coordinates of the last click within the window.
 *
 * @type {() => ClickCoordinates}
 * @returns {ClickCoordinates} An object containing reactive cells for the x and y coordinates of the last click.
 *
 * @example
 * import { useClickCoordinates } from 'retend-utils/hooks';
 *
 * function MyComponent() {
 *   const { x, y } = useClickCoordinates();
 *
 *   return (
 *     <div>
 *       Last Click Position: X: {x}, Y: {y}
 *     </div>
 *   );
 * }
 */
export const useClickCoordinates = createSharedHook({
  key: CLICK_COORDINATES_KEY,
  initialData: () => ({
    cells: { x: Cell.source(0), y: Cell.source(0) },
    count: 0,
  }),
  setup: (data, { document }) => {
    data.handleClick = (event) => {
      if (event instanceof MouseEvent) {
        data.cells.x.set(event.clientX);
        data.cells.y.set(event.clientY);
      }
    };
    document.addEventListener('click', data.handleClick);
  },
  teardown: (data, { document }) => {
    document.removeEventListener('click', data.handleClick);
  },
  getValue: (data) => ({
    x: Cell.derived(() => data.cells.x.get()),
    y: Cell.derived(() => data.cells.y.get()),
  }),
});
