/** @import { SourceCell } from 'retend' */
/** @import { CreateGlobalStateHookOptions } from './_shared.js' */

import { getGlobalContext } from 'retend/context';
import { createGlobalStateHook } from './_shared.js';
import { Cell } from 'retend';

const LOCAL_STORAGE_CACHE_KEY = Symbol('hooks:useLocalStorage:cache');
const SESSION_STORAGE_CACHE_KEY = Symbol('hooks:useSessionStorage:cache');

/**
 * Represents primitive JSON values.
 * @typedef {string | number | boolean | null} JSONPrimitive
 */

/**
 * Represents a JSON object (values must be JSONSerializable).
 * Note: This still relies on the final JSONSerializable type.
 * @typedef {{ [key: string]: JSONSerializable }} JSONObject
 */

/**
 * Represents a JSON array (elements must be JSONSerializable).
 * Note: This still relies on the final JSONSerializable type.
 * @typedef {JSONSerializable[]} JSONArray
 */

/**
 * Represents a value that can be safely converted to and from JSON.
 * Uses intermediate types in an attempt to break the direct circularity.
 * @typedef {JSONPrimitive | JSONArray | JSONObject} JSONSerializable
 */
/**
 * Creates a reactive cell synchronized with localStorage.
 * @type {<U extends JSONSerializable>(key: string, initialValue: U) => SourceCell<U>}
 *
 * @remarks
 * - Values are stored as JSON strings. Ensure data is JSON-serializable.
 * - In non-browser environments (like SSR), returns a non-persistent cell initialized with `initialValue`.
 *
 * @example
 * ```tsx
 * import { useLocalStorage } from 'retend-utils/hooks';
 *
 * const theme = useLocalStorage('theme', 'light');
 *
 * console.log(theme.get()); // 'light' or stored value
 * theme.set('dark'); // Updates localStorage
 * ```
 */
export const useLocalStorage = createGlobalStateHook(
  storageOptions(LOCAL_STORAGE_CACHE_KEY, 'localStorage')
);

/**
 * Creates a reactive cell synchronized with sessionStorage.
 * @type {<U extends JSONSerializable>(key: string, initialValue: U) => SourceCell<U>}
 *
 * @remarks
 * - Values are stored as JSON strings. Ensure data is JSON-serializable.
 * - Data persists only for the browser session.
 * - In non-browser environments (like SSR), returns a non-persistent cell initialized with `initialValue`.
 *
 * @example
 * ```tsx
 * import { useSessionStorage } from 'retend-utils/hooks';
 *
 * const temporaryToken = useSessionStorage('sessionToken', null);
 *
 * if (!temporaryToken.get()) {
 *   // Fetch and set token
 *   temporaryToken.set(await fetchToken());
 * }
 * ```
 */
export const useSessionStorage = createGlobalStateHook(
  storageOptions(SESSION_STORAGE_CACHE_KEY, 'sessionStorage')
);

/**
 * Safely parses a JSON string and returns the parsed value or null on error.
 * @template T
 * @param {string} jsonString - The JSON string to parse.
 * @returns {T} The parsed value or null if parsing fails.
 */
function safeParseJson(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    // @ts-ignore: The error is a JSON.parse error.
    return null;
  }
}

/**
 * @param {string} cacheKey
 * @param {'localStorage' | 'sessionStorage'} storage
 * @returns {CreateGlobalStateHookOptions<[string, any], Map<string, SourceCell<any>>, SourceCell<any>>}
 */
function storageOptions(cacheKey, storage) {
  return {
    cacheKey,
    createSource: () => new Map(),
    initializeState(window, map) {
      for (const [key, coreCell] of map.entries()) {
        const value = window[storage].getItem(key);
        if (value) {
          coreCell.set(safeParseJson(value));
        }
      }
    },
    setupListeners: (window, map) => {
      window.addEventListener('storage', (event) => {
        if (event.storageArea !== window[storage]) return;
        const { key, newValue } = event;
        if (!key) return;

        const cell = map.get(key);
        if (cell && newValue) {
          cell.set(safeParseJson(newValue));
        } else if (cell) {
          // @ts-ignore: Default to null.
          cell.set(null);
        }
      });
    },
    createReturnValue: (map, key, initialValue) => {
      const { window } = getGlobalContext();
      let coreCell = map.get(key);
      if (!coreCell) {
        const valueFromStorage = window[storage].getItem(key);
        const value = valueFromStorage
          ? safeParseJson(valueFromStorage)
          : initialValue;
        coreCell = Cell.source(value, { deep: true });
        map.set(key, coreCell);
        if (!valueFromStorage) {
          window[storage].setItem(key, JSON.stringify(value));
        }
        coreCell.listen((value) => {
          const { window } = getGlobalContext();
          window[storage].setItem(key, JSON.stringify(value));
        });
      }

      const returnCell = Cell.source(coreCell.get(), { deep: true });
      returnCell.listen((value) => {
        coreCell.set(value);
      });
      /** @param {unknown} value */
      const update = (value) => {
        returnCell.set(value);
      };
      coreCell.listen(update, { weak: true });

      // Set on returnCell to prevent GC as long as the returned cell
      // is in memory.
      Reflect.set(returnCell, '__:update', update);
      return returnCell;
    },
  };
}
