import { Cell } from 'retend';
import { createGlobalStateHook } from './_shared.js';

/**
 * @typedef {object} ClickCoordinates
 * @property {Cell<number>} x - The x coordinate of the last click.
 * @property {Cell<number>} y - The y coordinate of the last click.
 */

const CLICK_COORDINATES_KEY = Symbol('hooks:useClickCoordinates:position');

/**
 * Tracks the coordinates of the last click within the window.
 *
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
export const useClickCoordinates = createGlobalStateHook({
  cacheKey: CLICK_COORDINATES_KEY,
  createSource: () => ({ x: Cell.source(0), y: Cell.source(0) }),
  setupListeners: (window, cells) => {
    /**
     * @param {MouseEvent} event
     */
    const updatePosition = (event) => {
      cells.x.set(event.clientX);
      cells.y.set(event.clientY);
    };
    window.addEventListener('click', updatePosition, { passive: true });
  },
  /** @returns {ClickCoordinates}*/
  createReturnValue: (cells) => ({
    x: Cell.derived(() => cells.x.get()),
    y: Cell.derived(() => cells.y.get()),
  }),
});
