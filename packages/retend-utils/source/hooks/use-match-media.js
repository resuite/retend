import { Cell, SourceCell, useSetupEffect } from 'retend';
import { getGlobalContext } from 'retend/context';

const MATCH_MEDIA_CACHE_KEY = Symbol('hooks:useMatchMedia:queriesCache');

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
export const useMatchMedia = (query) => {
  const { globalData } = getGlobalContext();
  /** @type {Map<string, [SourceCell<boolean>, number]> | undefined} */
  let queries = globalData.get(MATCH_MEDIA_CACHE_KEY);
  if (!queries) {
    queries = new Map();
    globalData.set(MATCH_MEDIA_CACHE_KEY, queries);
  }
  /** @type {MediaQueryList | undefined} */
  let mediaQueryList;
  let data = queries.get(query);
  if (!data) {
    const { window } = getGlobalContext();
    mediaQueryList =
      'matchMedia' in window ? window.matchMedia(query) : undefined;
    const initialValue = mediaQueryList ? mediaQueryList.matches : false;
    data = [Cell.source(initialValue), 0];
    queries.set(query, data);
  }
  const [match] = data;
  useSetupEffect(() => {
    /** @type (event: MediaQueryListEvent) => void */
    let listener;
    if (data[1] === 0) {
      mediaQueryList = window.matchMedia(query);
      data[0].set(mediaQueryList.matches);
      listener = (event) => data[0].set(event.matches);
      mediaQueryList?.addEventListener('change', listener);
    }
    data[1]++;
    return () => {
      data[1]--;
      if (data[1] === 0) {
        mediaQueryList?.removeEventListener('change', listener);
        queries.delete(query);
      }
    };
  });
  return Cell.derived(() => match.get());
};
