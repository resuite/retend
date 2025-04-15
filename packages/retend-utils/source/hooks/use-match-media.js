/** @import { SourceCell } from 'retend' */
/** @import { CreateGlobalStateHookOptions } from './_shared.js' */

import { Cell } from 'retend';
import { createGlobalStateHook } from './_shared.js';

const MATCH_MEDIA_CACHE_KEY = 'hooks:useMatchMedia:queriesCache';

/** @type {CreateGlobalStateHookOptions<[string], Map<string, SourceCell<boolean>>, Cell<boolean>>} */
const options = {
  cacheKey: MATCH_MEDIA_CACHE_KEY,

  createSource: () => new Map(),

  initializeState: (window, savedQueries, query) => {
    const mediaQueryList = window.matchMedia(query);
    const sourceCell = Cell.source(mediaQueryList.matches);
    // Store the mediaQueryList on the cell object to manage its lifecycle
    Reflect.set(sourceCell, 'mediaQueryList', mediaQueryList);
    savedQueries.set(query, sourceCell);
  },

  setupListeners: (_, savedQueries, query) => {
    const sourceCell = savedQueries.get(query);
    if (!sourceCell) {
      throw new Error(`No query found for ${query}`);
    }
    const mediaQueryList = /** @type {MediaQueryList} */ (
      Reflect.get(sourceCell, 'mediaQueryList')
    );

    mediaQueryList.addEventListener('change', (event) => {
      sourceCell.value = event.matches;
    });
  },

  /**
   * @param {Map<string, SourceCell<boolean>>} savedQueries
   * @param {string} query
   * @returns {Cell<boolean>}
   */
  createReturnValue: (savedQueries, query) => {
    const queryCell = savedQueries.get(query);
    if (!queryCell) {
      throw new Error(`No query found for ${query}`);
    }
    return Cell.derived(() => queryCell.value);
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
