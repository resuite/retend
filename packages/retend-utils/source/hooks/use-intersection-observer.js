import { Cell, useObserver } from 'retend';

/**
 * @typedef {Cell<HTMLElement | null> | Cell<HTMLElement | null>[]} ObserverTarget
 */

/**
 * Uses the Intersection Observer API to observe changes in the intersection of a target with an ancestor or with a top-level document's viewport.
 *
 * @param {ObserverTarget} target
 * A Cell or an array of Cells, where each Cell contains a target HTMLElement to observe. The observer will be connected when the element(s) are available and disconnected when the element(s) are removed.
 *
 * @param {IntersectionObserverCallback} callback
 * A function that will be called when the intersection of any of the target elements with the root changes.
 *
 * @param {function(): IntersectionObserverInit} [options]
 * An optional function that returns an `IntersectionObserverInit` object to configure the observer.
 *
 * @example
 * ### Watching a single element
 * ```javascript
 * import { Cell } from 'retend';
 * import { useIntersectionObserver } from 'retend-utils/hooks';
 *
 * const MyComponent = () => {
 *   const elementRef = Cell.source(null);
 *
 *   // Observing a single element
 *   useIntersectionObserver(elementRef, ([entry]) => {
 *     if (entry.isIntersecting) {
 *       console.log('Single element is visible:', entry.target);
 *     } else {
 *       console.log('Single element is not visible:', entry.target);
 *     }
 *   }, () => ({
 *     rootMargin: '0px',
 *     threshold: 0.5 // Trigger when 50% of the element is visible
 *   }));
 *
 *   return (
 *     <div>
 *       <div ref={elementRef}>
 *         Observe me!
 *       </div>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * ### Watching an array of elements
 * ```javascript
 * import { Cell } from 'retend';
 * import { useIntersectionObserver } from 'retend-utils/hooks';
 *
 * const MyComponent = () => {
 *   const elementRef1 = Cell.source(null);
 *   const elementRef2 = Cell.source(null);
 *   const elementRefs = [elementRef1, elementRef2];
 *
 *   useIntersectionObserver(elementRefs, (entries) => {
 *     for (const entry of entries) {
 *       if (entry.isIntersecting) {
 *         console.log('Array element is visible:', entry.target);
 *       } else {
 *         console.log('Array element is not visible:', entry.target);
 *       }
 *     };
 *   }, () => ({
 *     rootMargin: '0px',
 *     threshold: 0.5 // Trigger when 50% of the element is visible
 *   }));
 *
 *   return (
 *     <div>
 *       <div ref={elementRef1}>
 *         Observe me!
 *       </div>
 *       <div ref={elementRef2}>
 *         Observe me too!
 *       </div>
 *     </div>
 *   )
 * };
 * ```
 */
export function useIntersectionObserver(target, callback, options) {
  const observer = useObserver();
  /** @type {IntersectionObserver | null} */
  let intersectionObserver = null;
  let observedCount = 0;

  const elements = Array.isArray(target) ? target : [target];

  for (const elementCell of elements) {
    observer.onConnected(elementCell, (element) => {
      if (!intersectionObserver) {
        intersectionObserver = new IntersectionObserver(callback, options?.());
      }
      intersectionObserver.observe(element);
      observedCount++;

      return () => {
        if (intersectionObserver) {
          intersectionObserver.unobserve(element);
          observedCount--;

          if (observedCount === 0) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
          }
        }
      };
    });
  }
}
