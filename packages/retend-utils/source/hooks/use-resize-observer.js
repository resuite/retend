/** @import { Cell } from 'retend' */
import { onConnected } from 'retend';

/**
 * @typedef {Cell<HTMLElement | null> | Cell<HTMLElement | null>[]} ResizeObserverTarget
 */

/**
 * Observes one or more elements with the Resize Observer API.
 *
 * @param {ResizeObserverTarget} target
 * A Cell or an array of Cells containing target HTMLElements to observe.
 *
 * @param {ResizeObserverCallback} callback
 * A function called when any observed element's size changes.
 *
 * @param {() => ResizeObserverOptions} [options]
 * An optional function returning options passed to `ResizeObserver.observe`.
 *
 * @example
 * ```javascript
 * import { Cell } from 'retend';
 * import { useResizeObserver } from 'retend-utils/hooks';
 *
 * const elementRef = Cell.source(null);
 *
 * useResizeObserver(elementRef, ([entry]) => {
 *   console.log(entry.contentRect.width, entry.contentRect.height);
 * });
 * ```
 */
export function useResizeObserver(target, callback, options) {
  /** @type {ResizeObserver | null} */
  let resizeObserver = null;
  let observedCount = 0;

  const elements = Array.isArray(target) ? target : [target];

  for (const elementCell of elements) {
    onConnected(elementCell, (element) => {
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(callback);
      }
      resizeObserver.observe(element, options?.());
      observedCount++;

      return () => {
        if (resizeObserver) {
          resizeObserver.unobserve(element);
          observedCount--;

          if (observedCount === 0) {
            resizeObserver.disconnect();
            resizeObserver = null;
          }
        }
      };
    });
  }
}
