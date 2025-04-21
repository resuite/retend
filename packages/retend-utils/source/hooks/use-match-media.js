/** @import { SourceCell } from 'retend' */
/** @import { CreateGlobalStateHookOptions } from './_shared.js' */

import { Cell } from 'retend';
import { createGlobalStateHook } from './_shared.js';
import { getGlobalContext, matchContext, Modes } from 'retend/context';

const MATCH_MEDIA_CACHE_KEY = 'hooks:useMatchMedia:queriesCache';

/** @type {CreateGlobalStateHookOptions<[string], Map<string, SourceCell<boolean>>, Cell<boolean>>} */
const options = {
  cacheKey: MATCH_MEDIA_CACHE_KEY,

  createSource: () => new Map(),

  setupListeners: (window, savedQueries) => {
    for (const [query, sourceCell] of savedQueries) {
      const mediaQueryList = window.matchMedia(query);
      sourceCell.value = mediaQueryList.matches;
      mediaQueryList.addEventListener('change', (event) => {
        sourceCell.value = event.matches;
      });
      // Store the mediaQueryList on the cell object to manage its lifecycle
      Reflect.set(sourceCell, '__mediaQueryList', mediaQueryList);
    }
  },

  /**
   * @param {Map<string, SourceCell<boolean>>} savedQueries
   * @param {string} query
   * @returns {Cell<boolean>}
   */
  createReturnValue: (savedQueries, query) => {
    const { window } = getGlobalContext();
    let cell = /** @type {SourceCell<boolean>} */ (savedQueries.get(query));

    if (!cell) {
      cell = Cell.source(false);
      savedQueries.set(query, cell);
      if (matchContext(window, Modes.Interactive)) {
        const mediaQueryList = window.matchMedia(query);
        cell.value = mediaQueryList.matches;
        mediaQueryList.addEventListener('change', (event) => {
          cell.value = event.matches;
        });
        // Store the mediaQueryList on the cell object to manage its lifecycle
        Reflect.set(cell, '__mediaQueryList', mediaQueryList);
      }
    }

    return Cell.derived(() => cell.value);
  },
};

/**
 * Creates a reactive cell that tracks the result of a media query.
 *
 * @param {string} query - The media query string (e.g., '(min-width: 768px)').
 * @returns {Cell<boolean>} A reactive cell whose value is `true` if the media query matches, `false` otherwise.
 * @type {(query: string) => Cell<boolean>}
 *
 *  @example
 * import { useMatchMedia } from 'retend-utils/hooks';
 *
 * const isLargeScreen = useMatchMedia('(min-width: 1024px)');
 * isLargeScreen.listen((matches) => {
 *   console.log(matches ? 'Large screen detected' : 'Small screen detected');
 * });
 */
export const useMatchMedia = createGlobalStateHook(options);
