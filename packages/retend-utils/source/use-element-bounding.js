import { useObserver, Cell } from 'retend';
import { getGlobalContext } from 'retend/context';

/**
 * @typedef BoundingRect
 *
 * A `BoundingRect` object containing reactive cells for each dimension.
 *
 * @property {Cell<number>} width A `Cell` containing the element's width.
 * @property {Cell<number>} height A `Cell` containing the element's height.
 * @property {Cell<number>} x A `Cell` containing the element's x-coordinate.
 * @property {Cell<number>} y A `Cell` containing the element's y-coordinate.
 * @property {Cell<number>} top A `Cell` containing the element's top coordinate.
 * @property {Cell<number>} right A `Cell` containing the element's right coordinate.
 * @property {Cell<number>} bottom A `Cell` containing the element's bottom coordinate.
 * @property {Cell<number>} left A `Cell` containing the element's left coordinate.
 */

/**
 * @typedef useElementBoundingOptions
 *
 * @property {boolean} [reset]
 * Whether to reset the bounding rectangle to its initial state when the element is removed from the DOM.
 * Defaults to `true`.
 *
 * @property {boolean} [windowResize]
 * Whether to update the bounding rectangle when the window is resized.
 * Defaults to `true`.
 *
 * @property {boolean} [windowScroll]
 * Whether to update the bounding rectangle when the window is scrolled.
 * Defaults to `true`.
 *
 * @property {'sync' | 'next-frame'} [updateTiming]
 * The timing for updating the bounding rectangle. Defaults to `'sync'`.
 */

/**
 * @template {HTMLElement} T
 *
 * Tracks the bounding rectangle of an HTML element reactively.
 *
 * Provides a `BoundingRect` object where each property (width, height, x, y, top,
 * right, bottom, left) is a reactive `Cell`.  These cells update automatically
 * whenever the element's size or position changes, due to either resizing or
 * layout shifts.
 *
 * @param {Cell<T | null>} elementRef A `Cell` containing a reference to the HTML element to track.
 * @param {useElementBoundingOptions} [options]
 * @returns {BoundingRect} A `BoundingRect` object containing reactive cells for each dimension.
 *
 * @example
 * ```tsx
 * import { Cell } from 'retend';
 * import { useElementBounding } from 'retend-utils/use-element-bounding';
 *
 * function MyComponent() {
 *   const elementRef = Cell.source(null);
 *   const rect = useElementBounding(elementRef);
 *
 *   return (
 *     <div ref={elementRef}>
 *       Observe my size: Width: {rect.width}, Height: {rect.height}
 *     </div>
 *   );
 * }
 * ```
 */

export function useElementBounding(elementRef, options = {}) {
  const {
    reset = true,
    windowResize = true,
    windowScroll = true,
    updateTiming = 'sync',
  } = options;
  const { globalData } = getGlobalContext();

  /** @type {(() => void) | undefined} */
  let windowResizeListener = globalData.get(
    'hooks:useBoundingRect:windowResizeListener'
  );

  /** @type {Set<(() => void)>} */
  let sizeWatchers = globalData.get('hooks:useBoundingRect:sizeWatchers');
  if (sizeWatchers === undefined) {
    sizeWatchers = new Set();
    globalData.set('hooks:useBoundingRect:sizeWatchers', sizeWatchers);
  }

  /** @type {(() => void) | undefined} */
  let windowScrollListener = globalData.get(
    'hooks:useBoundingRect:windowScrollListener'
  );

  /** @type {Set<(() => void)>} */
  let scrollWatchers = globalData.get('hooks:useBoundingRect:scrollWatchers');
  if (scrollWatchers === undefined) {
    scrollWatchers = new Set();
    globalData.set('hooks:useBoundingRect:scrollWatchers', scrollWatchers);
  }

  const width = Cell.source(0);
  const height = Cell.source(0);
  const x = Cell.source(0);
  const y = Cell.source(0);
  const top = Cell.source(0);
  const right = Cell.source(0);
  const bottom = Cell.source(0);
  const left = Cell.source(0);

  const observer = useObserver();

  const recalculate = () => {
    const element = elementRef.value;

    if (!element) {
      if (reset) {
        Cell.batch(() => {
          width.value = 0;
          height.value = 0;
          x.value = 0;
          y.value = 0;
          top.value = 0;
          right.value = 0;
          bottom.value = 0;
          left.value = 0;
        });
      }
      return;
    }

    const rect = element.getBoundingClientRect();
    Cell.batch(() => {
      width.value = rect.width;
      height.value = rect.height;
      x.value = rect.x;
      y.value = rect.y;
      top.value = rect.top;
      right.value = rect.right;
      bottom.value = rect.bottom;
      left.value = rect.left;
    });
  };

  const update = () => {
    if (updateTiming === 'sync') {
      recalculate();
    } else {
      const { window } = getGlobalContext();
      if ('requestAnimationFrame' in window) {
        window.requestAnimationFrame(recalculate);
      }
    }
  };

  observer.onConnected(elementRef, (element) => {
    const { globalData, window } = getGlobalContext();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    if (windowResize) {
      if (windowResizeListener === undefined) {
        windowResizeListener = () => {
          for (const watcher of sizeWatchers) watcher();
        };
        globalData.set(
          'hooks:useBoundingRect:windowResizeListener',
          windowResizeListener
        );
        window.addEventListener('resize', windowResizeListener);
      }
      sizeWatchers.add(update);
    }

    if (windowScroll) {
      if (windowScrollListener === undefined) {
        windowScrollListener = () => {
          for (const watcher of scrollWatchers) watcher();
        };
        globalData.set(
          'hooks:useBoundingRect:windowScrollListener',
          windowScrollListener
        );
        window.addEventListener('scroll', windowScrollListener);
      }
      scrollWatchers.add(update);
    }

    update();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (windowResizeListener !== undefined) {
        sizeWatchers.delete(update);
        if (sizeWatchers.size === 0) {
          window.removeEventListener('resize', windowResizeListener);
          globalData.delete('hooks:useBoundingRect:windowResizeListener');
        }
      }
      if (windowScrollListener !== undefined) {
        scrollWatchers.delete(update);
        if (scrollWatchers.size === 0) {
          window.removeEventListener('scroll', windowScrollListener);
          globalData.delete('hooks:useBoundingRect:windowScrollListener');
        }
      }
    };
  });

  return { width, height, x, y, top, right, bottom, left };
}
