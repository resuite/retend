import { Cell, useObserver } from 'retend';
/**
 * A hook that uses the Intersection Observer API to observe changes in the intersection of a target element with an ancestor element or with a top-level document's viewport.
 *
 * @param {Cell<HTMLElement | null>} element - A Cell containing the target HTMLElement to observe. The observer will be connected when the element is available and disconnected when the element is removed.
 * @param {IntersectionObserverCallback} callback - A function that will be called when the intersection of the target element with the root changes.
 * @param {function(): IntersectionObserverInit} [options] - An optional function that returns an `IntersectionObserverInit` object to configure the observer.
 *
 * @example
 * ```javascript
 * import { Cell } from 'retend';
 * import { useIntersectionObserver } from 'retend-utils/hooks';
 *
 * const MyComponent = () => {
 *   const elementRef = Cell.source(null);
 *
 *   useIntersectionObserver(elementRef, (entries) => {
 *     entries.forEach(entry => {
 *       if (entry.isIntersecting) {
 *         console.log('Element is visible!');
 *       } else {
 *         console.log('Element is not visible!');
 *       }
 *     });
 *   }, () => ({
 *     root: null, // Use the viewport as the root
 *     rootMargin: '0px',
 *     threshold: 0.5 // Trigger when 50% of the element is visible
 *   }));
 *
 *   return (
 *     <div ref={elementRef}>
 *       Observe me!
 *     </div>
 *   );
 * };
 * ```
 */
export const useIntersectionObserver = (element, callback, options) => {
  const observer = useObserver();
  observer.onConnected(element, (element) => {
    const intersectionObserver = new IntersectionObserver(
      callback,
      options?.()
    );
    intersectionObserver.observe(element);
    return () => intersectionObserver.disconnect();
  });
};
