/** @import { SourceCell } from 'retend' */

import { getGlobalContext } from 'retend/context';
import { createSharedHook } from '../internal/create-shared-hook.js';
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
export const useLocalStorage = createStorageOptions(
  LOCAL_STORAGE_CACHE_KEY,
  'localStorage'
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
export const useSessionStorage = createStorageOptions(
  SESSION_STORAGE_CACHE_KEY,
  'sessionStorage'
);

/**
 * Safely parses a JSON string and returns the parsed value or null on error.
 * @template T
 * @param {string} jsonString - The JSON string to parse.
 * @returns {T | null} The parsed value or null if parsing fails.
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
 * @param {symbol} key
 * @param {'localStorage' | 'sessionStorage'} storageType
 * @returns {<T>(key: string, initialValue: T) => SourceCell<T>}
 */
function createStorageOptions(key, storageType) {
  return createSharedHook({
    key,
    initialData: () => ({
      /** @type {Map<string, SourceCell<any>>} */
      cells: new Map(),
    }),
    setup: (data, window) => {
      data.handleStorageChange = (event) => {
        if (
          !(event instanceof StorageEvent) ||
          event.storageArea !== window[storageType] ||
          !event.key
        ) {
          return;
        }

        const cell = data.cells.get(event.key);
        if (cell) {
          const newValue = event.newValue;
          cell.set(newValue !== null ? safeParseJson(newValue) : null);
        }
      };
      window.addEventListener('storage', data.handleStorageChange);
    },
    teardown: (data, { window }) => {
      window.removeEventListener('storage', data.handleStorageChange);
    },
    getValue: (data, key, initialValue) => {
      let coreCell = data.cells.get(key);

      if (!coreCell) {
        const { window } = getGlobalContext();
        const valueFromStorage = window[storageType].getItem(key);
        const value =
          valueFromStorage !== null
            ? safeParseJson(valueFromStorage)
            : initialValue;

        coreCell = Cell.source(value, { deep: true });
        data.cells.set(key, coreCell);

        if (valueFromStorage === null) {
          window[storageType].setItem(key, JSON.stringify(value));
        }

        coreCell.listen((value) => {
          const { window } = getGlobalContext();
          window[storageType].setItem(key, JSON.stringify(value));
        });
      }

      const returnCell = Cell.source(coreCell.get(), { deep: true });

      returnCell.listen((value) => {
        coreCell.set(value);
      });

      /** @param {typeof initialValue} value */
      const update = (value) => {
        returnCell.set(value);
      };
      coreCell.listen(update, { weak: true });
      Reflect.set(returnCell, '__:update', update);
      return returnCell;
    },
  });
}
