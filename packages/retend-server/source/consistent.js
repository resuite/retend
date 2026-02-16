import { getGlobalContext } from 'retend/context';

const ConsistentValuesKey = Symbol.for('retend:consistent-values');

/**
 * @returns {Map<string, any>}
 */
function getConsistentMap() {
  const { globalData } = getGlobalContext();
  let map = globalData.get(ConsistentValuesKey);
  if (!map) {
    map = new Map();
    globalData.set(ConsistentValuesKey, map);
  }
  return map;
}

/**
 * Initializes the consistent value store with a predefined set of values.
 * Useful when transferring state between different rendering contexts or environments.
 *
 * @param {Map<string, unknown>} values - Initial values to populate the store.
 *                                       All values must be JSON-serializable.
 */
export function setConsistentValues(values) {
  const map = getConsistentMap();
  map.clear();
  for (const [key, value] of values) {
    map.set(key, value);
  }
}

/**
 * Retrieves the current state of all consistent values.
 * Use this to serialize and transfer values between environments.
 *
 * @returns {Map<string, unknown>} Map containing all stored consistent values
 */
export function getConsistentValues() {
  return new Map(getConsistentMap());
}

/**
 * Creates or retrieves a one-off value that must be identical between environments.
 * Perfect for random IDs, timestamps, and initial data fetches that should
 * match exactly during server/client transitions.
 *
 * @template T
 * @param {string} key - Unique identifier for this value. Keys should be:
 *                     - Descriptive and namespaced to avoid collisions
 *                     - Used for values that must match exactly
 * @param {() => T | Promise<T>} generator - Function to generate the value.
 *                                          Must return JSON-serializable data.
 * @returns {Promise<T>} The consistent value
 *
 * @notes
 * Consistent values can only be stored and retrieved once.
 * The main purpose of this limitation is to prevent memory leaks that could
 * occur if values are not removed after being read.
 */
export async function useConsistent(key, generator) {
  const map = getConsistentMap();
  if (map.has(key)) {
    const value = map.get(key);
    map.delete(key);
    return value;
  }
  const value = await generator();
  map.set(key, value);
  return value;
}
