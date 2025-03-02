/**
 * Storage for one-time computed values that need to persist across environment transitions.
 * Values are removed after first read to prevent memory leaks.
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
 * @example
 * // Generate IDs that match during hydration
 * const id = await useConsistent('todo/new-item', crypto.randomUUID);
 *
 * // Keep creation timestamps identical
 * const created = await useConsistent('post/timestamp', Date.now);
 *
 * // Ensure initial data matches
 * const posts = await useConsistent('blog/initial-posts', () =>
 *   fetch('/api/posts').then(r => r.json())
 * );
 *
 * @notes
 * As earlier stated, consistent values can only be stored and retrieved once,
 * The main purpose of this limitation is to prevent memory leaks that could
 * occur if values are not removed after being read.
 */
export async function useConsistent(key, generator) {
  if (consistentValues.has(key)) {
    const value = consistentValues.get(key);
    consistentValues.delete(key);
    // @ts-expect-error
    return value;
  }
  const value = await generator();
  consistentValues.set(key, value);
  return value;
}
