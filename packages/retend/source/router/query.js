import { Cell } from '@adbl/cells';
import { useRouter } from './index.js';

/**
 * @typedef {Object} AsyncRouteQuery
 * @property {(key: string) => Cell<boolean>} has
 * Reactively checks if a query parameter exists.
 * @property {(key: string) => Cell<string|null>} get
 * Returns a cell referencing the value of a query parameter.
 * @property {(key: string, value: string) => Promise<void>} set
 * Sets a query parameter, triggering a route update.
 * @property {(key: string, value: string) => Promise<void>} append
 * Appends a query parameter, triggering a route update.
 * @property {(key: string) => Cell<string[]>} getAll
 * Reactively gets all values of a query parameter.
 * @property {() => Promise<void>} clear
 * Clears all query parameters, triggering a route update.
 * @property {(...keys: string[]) => Promise<void>} delete
 * Deletes a query parameter, triggering a route update.
 * @property {() => string} toString - Returns the current query parameters as a string.
 */

/**
 * Returns a reactive wrapper for the query parameters of the current route.
 *
 * @returns {AsyncRouteQuery} - An object containing reactive query parameter accessors and mutators.
 *
 * @example
 * ```jsx
 * import { useRouteQuery } from 'retend/router';
 *
 * function MyComponent() {
 *   const query = useRouteQuery();
 *
 *   // Reactively check if a 'search' parameter exists
 *   const hasSearch = query.has('search');
 *
 *   // Reactively get the value of the 'search' parameter
 *   const searchValue = query.get('search');
 *
 *   // Function to set the 'sort' parameter
 *   const setSort = async (value) => {
 *     await query.set('sort', value);
 *   };
 *
 *   // Function to add a filter parameter
 *   const addFilter = async (filterValue) => {
 *     await query.append('filter', filterValue);
 *   };
 *
 *   // Reactive display of the search value
 *   return (
 *     <div>
 *       <p>Has search parameter: {hasSearch}</p>
 *       <p>Search value: {searchValue}</p>
 *       <button onClick={() => setSort('name')}>Sort by Name</button>
 *       <button onClick={() => addFilter('category1')}>Add Category 1 Filter</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRouteQuery() {
  const router = useRouter();
  const currentRoute = router.getCurrentRoute();

  /**
   * Creates a new URL with the given query parameters and triggers a navigation to that URL.
   * This helper is to avoid redundant code and improve readability.
   * @param {function(URLSearchParams): void} updateSearchParams - Callback that updates the search params
   */

  const updateQuery = async (updateSearchParams) => {
    const newSearchParams = new URLSearchParams(
      currentRoute.get().query.toString()
    );
    updateSearchParams(newSearchParams);
    const nextRoute = `${
      currentRoute.get().path
    }?${newSearchParams.toString()}`;
    await router.navigate(nextRoute);
  };

  /**
   * Reactively checks if a query parameter exists.
   *
   * @param {string} key - The query parameter key to check
   * @returns {import('@adbl/cells').Cell<boolean>}
   */
  const has = (key) => {
    return Cell.derived(() => currentRoute.get().query.has(key));
  };

  /**
   * Reactively gets the value of a query parameter.
   *
   * @param {string} key - The query parameter key to get
   * @returns {import('@adbl/cells').Cell<string|null>}
   */
  const get = (key) => {
    return Cell.derived(() => currentRoute.get().query.get(key));
  };

  /**
   * Sets a query parameter, triggering a route update.
   *
   * @param {string} key - The query parameter key to set
   * @param {string} value - The value to set
   */
  const set = async (key, value) => {
    await updateQuery((searchParams) => searchParams.set(key, value));
  };

  /**
   * Appends a query parameter, triggering a route update.
   *
   * @param {string} key - The query parameter key to append
   * @param {string} value - The value to append
   */
  const append = async (key, value) => {
    await updateQuery((searchParams) => searchParams.append(key, value));
  };

  /**
   * Clears all query parameters, triggering a route update.
   */
  const clear = async () => {
    await updateQuery((searchParams) =>
      searchParams.forEach((_, key) => searchParams.delete(key))
    );
  };

  /**
   * Deletes a query parameter or multiple query parameters, triggering a route update.
   *
   * @param {string[]} keys - The query parameter key to delete
   */
  const del = async (...keys) => {
    await updateQuery((searchParams) => {
      for (const key of keys) searchParams.delete(key);
    });
  };

  /**
   * @param {string} key
   */
  const getAll = (key) => {
    return Cell.derived(() => currentRoute.get().query.getAll(key));
  };

  /**
   * Returns the current query parameters as a string.
   *
   * @returns {string} The query string
   */
  const toStringFn = () => {
    return currentRoute.get().query.toString();
  };

  const routeQueryObject = {
    has,
    get,
    set,
    append,
    clear,
    delete: del,
    toString: toStringFn,
    getAll,
  };

  // @ts-ignore: Attaching the current route prevents premature garbage collection.
  routeQueryObject.currentRoute = currentRoute;

  return routeQueryObject;
}
