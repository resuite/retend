/** @typedef {(...args: any[]) => any} AnyFunction */

/**
 * Utility type that checks if a type is JSON serializable.
 *
 * @template T
 * @typedef {T extends null ? true :
 *   T extends string | number | boolean ? true :
 *   T extends Array<infer U> ? IsSerializableValue<U> :
 *   T extends Date ? true :
 *   T extends object ?
 *     T extends AnyFunction ? false :
 *     T extends Promise<any> ? false :
 *     T extends Map<any, any> ? false :
 *     T extends Set<any> ? false :
 *     T extends Error ? false :
 *     T extends RegExp ? false :
 *     T extends symbol ? false :
 *     T extends WeakMap<any, any> ? false :
 *     T extends WeakSet<any> ? false :
 *     { [K in keyof T]: IsSerializableValue<T[K]> }[keyof T] extends true ? true : false
 *   : false} IsSerializableValue
 */

/**
 * @template M
 * @typedef {() => Promise<M>} ModuleImporter
 */

/**
 * Extracts serializable values from a module.
 * Serializable values include strings, numbers, booleans, null, Dates, arrays of serializable values,
 * and objects with serializable values.
 *
 * @template {object} M
 * @typedef {{
 *   [K in keyof M as IsSerializableValue<M[K]> extends true ? K : never]: M[K];
 * }} SerializedModule
 */

/**
 * @typedef {Object} Module
 */

/**
 * Retrieves pre-computed data from a specified module, generated during build or server-side rendering (SSR).
 *
 * Use this in client components to access results from server-only logic that was executed
 * during the build/SSR phase. The results are embedded in the client bundle or SSR payload.
 *
 * **Constraints:**
 * - The target module (`m`) is executed *only* during build/SSR.
 * - Only JSON-serializable data is transferred: raw values (strings, numbers, booleans, null, Dates, arrays/objects containing only serializable values).
 * - Functions, Promises, Maps, Sets, etc., are *not* transferred.
 *
 * @template {Module} M - An object type representing the expected exports of the target module.
 * @param {() => Promise<M>} m - A function returning a dynamic `import()` pointing to the
 *   server/build-only module. This path is analyzed at build time.
 * @returns {Promise<SerializedModule<M>>} - A Promise resolving to an object containing the
 *   captured serializable data. Accessing properties yields captured values.
 *
 * @example
 * // ===== config.server.js =====
 * // Server-only imports
 * import process from 'node:fs';
 *
 * // Export a simple serializable value
 * export const buildEnvironment = process.env.NODE_ENV || 'development';
 *
 * // Export a Date (will be serialized/deserialized)
 * export const generatedAt = new Date();
 *
 * // ===== App.jsx =====
 * import { getServerSnapshot } from 'retend-server/client';
 *
 * export async function MyComponent() {
 *   const snapshot = await getServerSnapshot(() => import('./config.server.js'));
 *   const environment = snapshot.buildEnvironment;
 *   const generationTime = snapshot.generatedAt;
 *
 *   return (
 *     <div className="app-container">
 *       <h1>Application Status</h1>
 *       <p>Running in: <strong>{environment}</strong> mode.</p>
 *       <p>Generated At: {generationTime.toLocaleString()}</p>
 *     </div>
 *   );
 * }
 */
export async function getServerSnapshot(m) {
  // This doesn't actually do anything.
  // When the call to getServerSnapshot is transformed,
  // instead of a module we get a JSON object embedded
  // directly in the client bundle.

  /** @type {import('./types.js').StaticModule} */
  const staticModuleRepresentation = /** @type {*} */ (await m());

  //@ts-ignore: We create a proxy representing the server module's serializable data.
  return new Proxy(staticModuleRepresentation, {
    get(_, prop) {
      if (prop === 'then' || typeof prop === 'symbol') return undefined;
      const valueSchema = staticModuleRepresentation[prop];

      if (!valueSchema) {
        const message = `Data for "${prop}" was not available at build/SSR time or was not serializable.`;
        console.error(message);
        return null;
      }

      switch (valueSchema.type) {
        case 'raw':
          return valueSchema.value;
        case 'date':
          return new Date(valueSchema.value);
        default: {
          const message = `Data for "${prop}" is not serializable.`;
          console.error(message);
          return null;
        }
      }
    },
  });
}
