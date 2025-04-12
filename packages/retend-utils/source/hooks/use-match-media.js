/** @import { GlobalContextChangeEvent } from 'retend/context' */
/** @import { SourceCell } from 'retend' */

import { Cell } from 'retend';
import { getGlobalContext, matchContext, Modes } from 'retend/context';

/**
 * Creates a reactive cell that tracks the result of a media query.
 *
 * @param {string} query - The media query to match.
 * @returns {Cell<boolean>} A cell that contains a boolean indicating whether the media query matches.
 *
 *  @example
 * import { useMatchMedia } from 'retend-utils/hooks';
 *
 * const isLargeScreen = useMatchMedia('(min-width: 1024px)');
 * isLargeScreen.listen((matches) => {
 *   console.log(matches ? 'Large screen' : 'Small screen');
 * });
 */
export function useMatchMedia(query) {
  const { window } = getGlobalContext();
  const matches = Cell.source(false);

  if (matchContext(window, Modes.VDom)) {
    /** @param {GlobalContextChangeEvent} event */
    const changeContext = (event) => {
      const { newContext } = event.detail;
      if (
        newContext?.window &&
        matchContext(newContext.window, Modes.Interactive)
      ) {
        listenToWindow(newContext.window, matches, query);
        // @ts-expect-error: Custom events are not properly typed in JS.
        window.removeEventListener('globalcontextchange', changeContext);
      }
    };
    // @ts-expect-error: Custom events are not properly typed in JS.
    window.addEventListener('globalcontextchange', changeContext);

    return matches;
  }

  listenToWindow(window, matches, query);
  return matches;
}

/**
 * @param {Window} window
 * @param {SourceCell<boolean>} matches
 * @param {string} query
 */
function listenToWindow(window, matches, query) {
  const mediaQueryList = window.matchMedia(query);
  matches.value = mediaQueryList.matches;
  mediaQueryList.addEventListener('change', () => {
    matches.value = mediaQueryList.matches;
  });
  Reflect.set(matches, 'mediaQueryList', mediaQueryList); // Prevent GC of mediaQueryList
}
