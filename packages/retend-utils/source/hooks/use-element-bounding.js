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

const RESIZE_LISTENER_KEY = 'hooks:useElementBounding:resizeListener';
const SIZE_WATCHERS_KEY = 'hooks:useElementBounding:sizeWatchers';
const SCROLL_LISTENER_KEY = 'hooks:useElementBounding:scrollListener';
const SCROLL_WATCHERS_KEY = 'hooks:useElementBounding:scrollWatchers';

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
 *
 * @property {boolean} [ignoreTransforms]
 * Whether to ignore CSS transforms when calculating the bounding rectangle.
 * Defaults to `false`.
 */

/**
 *
 * Tracks the bounding rectangle of an HTML element reactively.
 *
 * Provides a `BoundingRect` object where each property (width, height, x, y, top,
 * right, bottom, left) is a reactive `Cell`.  These cells update automatically
 * whenever the element's size or position changes, due to either resizing or
 * layout shifts.
 *
 * @param {Cell<HTMLElement | null>} elementRef A `Cell` containing a reference to the HTML element to track.
 * @param {useElementBoundingOptions} [options]
 * @returns {BoundingRect} A `BoundingRect` object containing reactive cells for each dimension.
 *
 * @example
 * ```tsx
 * import { Cell } from 'retend';
 * import { useElementBounding } from 'retend-utils/hooks';
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
    ignoreTransforms = false,
  } = options;

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
    const element = elementRef.get();

    if (!element) {
      if (reset) {
        width.set(0);
        height.set(0);
        x.set(0);
        y.set(0);
        top.set(0);
        right.set(0);
        bottom.set(0);
        left.set(0);
      }
      return;
    }

    const rect = ignoreTransforms
      ? getBoundingClientRectWithoutTransforms(element)
      : element.getBoundingClientRect();

    width.set(rect.width);
    height.set(rect.height);
    x.set(rect.x);
    y.set(rect.y);
    top.set(rect.top);
    right.set(rect.right);
    bottom.set(rect.bottom);
    left.set(rect.left);
  };

  const update = () => {
    if (updateTiming === 'sync') {
      recalculate();
    } else {
      requestAnimationFrame(recalculate);
    }
  };

  observer.onConnected(elementRef, (element) => {
    const { globalData } = getGlobalContext();

    /** @type {(() => void) | undefined} */
    let resizeListener = globalData.get(RESIZE_LISTENER_KEY);
    /** @type {(() => void) | undefined} */
    let windowScrollListener = globalData.get(SCROLL_LISTENER_KEY);

    /** @type {Set<(() => void)>} */
    const sizeWatchers = globalData.get(SIZE_WATCHERS_KEY) ?? new Set();
    globalData.set(SIZE_WATCHERS_KEY, sizeWatchers);

    /** @type {Set<(() => void)>} */
    const scrollWatchers = globalData.get(SCROLL_WATCHERS_KEY) ?? new Set();
    globalData.set(SCROLL_WATCHERS_KEY, scrollWatchers);

    element.addEventListener('animationstart', update);
    element.addEventListener('animationcancel', update);
    element.addEventListener('transitionstart', update);
    element.addEventListener('animationiteration', update);
    element.addEventListener('animationend', update);
    element.addEventListener('transitionend', update);

    // ---- Watch for element resizes ----
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);

    // ----- Watch for style changes ----
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // --- Watch for window resizes ---
    if (windowResize) {
      if (resizeListener === undefined) {
        resizeListener = () => {
          Cell.batch(() => {
            for (const watcher of sizeWatchers) watcher();
          });
        };
        globalData.set(RESIZE_LISTENER_KEY, resizeListener);
        window.addEventListener('resize', resizeListener);
      }
      sizeWatchers.add(update);
    }

    if (windowScroll) {
      if (windowScrollListener === undefined) {
        windowScrollListener = () => {
          Cell.batch(() => {
            for (const watcher of scrollWatchers) watcher();
          });
        };
        globalData.set(SCROLL_LISTENER_KEY, windowScrollListener);
        window.addEventListener('scroll', windowScrollListener, {
          passive: true,
        });
      }
      scrollWatchers.add(update);
    }

    update();

    return () => {
      element.removeEventListener('animationstart', update);
      element.removeEventListener('animationcancel', update);
      element.removeEventListener('animationiteration', update);
      element.removeEventListener('animationend', update);
      element.removeEventListener('transitionstart', update);
      element.removeEventListener('transitionend', update);

      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (resizeListener !== undefined) {
        sizeWatchers.delete(update);
        if (sizeWatchers.size === 0) {
          window.removeEventListener('resize', resizeListener);
          globalData.delete(RESIZE_LISTENER_KEY);
        }
      }
      if (windowScrollListener !== undefined) {
        scrollWatchers.delete(update);
        if (scrollWatchers.size === 0) {
          window.removeEventListener('scroll', windowScrollListener);
          globalData.delete(SCROLL_LISTENER_KEY);
        }
      }
    };
  });

  return { width, height, x, y, top, right, bottom, left };
}

/** @param {HTMLElement} element */
function getBoundingClientRectWithoutTransforms(element) {
  let x = 0;
  let y = 0;
  let currentElement = element;

  while (currentElement) {
    x += currentElement.offsetLeft;
    y += currentElement.offsetTop;
    currentElement = /** @type {HTMLElement} */ (currentElement.offsetParent);
  }

  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  return {
    width: element.offsetWidth,
    height: element.offsetHeight,
    x: x - scrollLeft,
    y: y - scrollTop,
    top: y - scrollTop,
    right: x - scrollLeft + element.offsetWidth,
    bottom: y - scrollTop + element.offsetHeight,
    left: x - scrollLeft,
  };
}
