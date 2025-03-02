/**
 * Storage for values that need to remain consistent across multiple renders and environments.
 * @type {Map<string, unknown>}
 */
let consistentValues = new Map();

/**
 * Initializes the consistent value store with a predefined set of values.
 * Useful when transferring state between different rendering contexts or environments.
 *
 * @param {Map<string, unknown>} values - Initial values to populate the store.
 *                                       All values must be JSON-serializable.
 */
export function setConsistentValues(values) {
  consistentValues = new Map(values);
}

/**
 * Retrieves the current state of all consistent values.
 * Use this to serialize and transfer values between environments.
 *
 * @returns {Map<string, unknown>} Map containing all stored consistent values
 */
export function getConsistentValues() {
  return new Map(consistentValues);
}

/**
 * Creates or retrieves a  value that remains consistent across renders and environments.
 * Perfect for timestamps, random IDs, or any value that should stay stable.
 *
 * @template T
 * @param {string} key - Unique identifier for this value. Keys should be:
 *                     - Descriptive and namespaced to avoid collisions
 *                     - Consistent between renders
 *                     - Never reused for different types of values
 * @param {() => T | Promise<T>} generator - Function to generate the initial value.
 *                                          Must return JSON-serializable data.
 * @returns {Promise<T>} The consistent value
 *
 * @example
 * // Generate stable IDs
 * const id = await useConsistent('user-list/new-item-id', crypto.randomUUID);
 *
 * // Keep timestamps consistent
 * const created = await useConsistent('post/created-at', () => Date.now());
 *
 * // Cache expensive computations
 * const data = await useConsistent('settings/computed', async () => {
 *   const response = await fetch('/api/settings');
 *   return response.json();
 * });
 */
export async function useConsistent(key, generator) {
  if (consistentValues.has(key)) {
    //@ts-ignore: The key is guaranteed to exist in the map as the correct type.
    return consistentValues.get(key);
  }
  const value = await generator();
  consistentValues.set(key, value);
  return value;
}
