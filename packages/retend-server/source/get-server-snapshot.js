/** @import { StaticModule } from './types.js' */
import { getGlobalContext } from 'retend/context';

/**
 * @typedef {(...args: unknown[]) => unknown} AnyFunction
 */

/**
 * Utility type that checks if a type is JSON serializable.
 *
 * @template T
 * @typedef {T extends null ? true :
 *   T extends string | number | boolean ? true :
 *   T extends Array<infer U> ? IsSerializable<U> :
 *   T extends Date ? true :
 *   T extends object ?
 *     T extends AnyFunction ? false :
 *     T extends Promise<unknown> ? false :
 *     T extends Map<unknown, unknown> ? false :
 *     T extends Set<unknown> ? false :
 *     T extends Error ? false :
 *     T extends RegExp ? false :
 *     T extends symbol ? false :
 *     T extends WeakMap<any, any> ? false :
 *     T extends WeakSet<any> ? false :
 *     { [K in keyof T]: IsSerializable<T[K]> }[keyof T] extends true ? true : false
 *   : false} IsSerializable
 */

/**
 * Filters keys in a type `T` whose values extend `ValueType`.
 *
 * @template T
 * @template ValueType
 * @typedef {T extends object ? {
 *   [K in keyof T]: T[K] extends ValueType ? K : never;
 * }[keyof T] : never} FilterKeysByValueType
 */

/**
 * @template M
 * @typedef {() => Promise<M>} ModuleImporter
 */

/**
 * Helper type to check if a function returns a serializable type.
 *
 * @template {AnyFunction} F
 * @typedef {F extends (...args: unknown[]) =>  infer R | Promise<infer R>
 *   ? IsSerializable<R> extends true ? true : false
 *   : false} ReturnsSerializablePromise
 */

/**
 * Extracts serializable values and functions returning serializable Promises from a module.
 * Serializable values include strings, numbers, booleans, null, Dates, arrays of serializable values,
 * and objects with serializable values. Functions must return a Promise resolving to a serializable value.
 *
 * @template {object} M
 * @typedef {Promise<{
 *   [K in FilterKeysByValueType<M, AnyFunction> as
 *     ReturnsSerializablePromise<M[K] extends AnyFunction ? M[K] : never> extends true
 *       ? K : never]: M[K];
 * } & {
 *   [K in keyof M as M[K] extends AnyFunction ? never : IsSerializable<M[K]> extends true ? K : never]: M[K];
 * }>} SerializedModule
 */

/**
 * @typedef {Object} Module
 */

/**
 * Retrieves pre-computed data from a specified module, generated during build or server-side rendering (SSR).
 *
 * Use this in client components to access results from server-only logic that was executed *once*
 * during the build/SSR phase. The results are embedded in the client bundle or SSR payload.
 *
 * Calling a function on the returned object provides the *pre-computed result* captured
 * during build/SSR; the original function is *not* re-executed on the client.
 *
 * **Constraints:**
 * - The target module (`m`) is executed *only* during build/SSR .
 * - Only JSON-serializable data is transferred: raw values and the *resolved, serializable return values*
 *   of functions executed during build/SSR. Functions themselves Promises, Maps, Sets, etc., are not transferred.
 *
 * @template {object} M - An object type representing the expected exports of the target module.
 * @param {() => Promise<M>} m - A function returning a dynamic `import()` pointing to the
 *   server/build-only module. This path is analyzed at build time.
 * @returns {Promise<SerializedModule<M>>} - A Promise resolving to an object containing the
 *   captured serializable data. Accessing properties yields captured values; calling
 *   functions yields their single, pre-computed result (async if the original was async).
 *
 * @example
 * // server.js (runs during build/SSR)
 * import { getHostname, getPlatform } from 'node:os';
 *
 * export const message = "Hello from the server!";
 * export async function getSystemInfo() {
 *   return {
 *     hostname: await getHostname(),
 *     platform: await getPlatform(),
 *   };
 * };
 *
 * // App.jsx (runs on the client)
 * import { getServerSnapshot } from 'retend/server';
 *
 * function App() {
 *   const data = await getServerSnapshot(() => import('./server.js'));
 *   const { message, getSystemInfo } = data;
 *   const systemInfo = await getSystemInfo();
 *   return (
 *   <div>
 *     <h1>Server Message: {message}</h1>
 *     <h2>System Info: {JSON.stringify(systemInfo)}</h2>
 *   </div>
 *   );
 * }
 */
export async function getServerSnapshot(m) {
  // m is a function that returns an import in source,
  // but it gets rewritten to a string by the plugin transform.
  const hash = String(m);
  if (import.meta.env.SSR) {
    const { globalData } = getGlobalContext();
    /** @type {Map<string, string>} */
    const serverModulesMap = globalData.get('server:serverModulesMap');
    const serverModuleTruePath = serverModulesMap.get(hash);
    if (!serverModuleTruePath) {
      throw new Error(`Server module not found for hash ${hash}.`);
    }
    const serverModule = await import(/* @vite-ignore */ serverModuleTruePath);
    /** @type {Record<string, StaticModule>} */
    const staticImports = globalData.get('server:staticImports');
    if (!staticImports[hash]) {
      // Save all atomic, easily serializable values.
      /** @type {StaticModule} */
      const moduleCache = {};
      for (const [key, value] of Object.entries(serverModule)) {
        if (
          typeof value === 'function' ||
          typeof value === 'symbol' ||
          typeof value === 'undefined'
        ) {
          continue;
        }
        try {
          const parsedValue = JSON.parse(JSON.stringify(value));
          moduleCache[key] = { type: 'raw', value: parsedValue };
        } catch {}
      }

      staticImports[hash] = moduleCache;
    }

    return new Proxy(serverModule, {
      get(_, prop) {
        const target = serverModule[prop];
        if (typeof prop === 'string') {
          if (typeof target === 'function') {
            return async () => {
              const module = staticImports[hash];
              const functionCallResult = target();
              const isAsync = functionCallResult instanceof Promise;
              module[prop] = {
                type: 'function',
                isAsync,
                returnValue: await functionCallResult,
              };
              staticImports[hash] = module;
              return functionCallResult;
            };
          }
        }
        return target;
      },
    });
  }

  //@ts-expect-error: We create a "window" into the server, or a serialized variant of it.
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then' || typeof prop === 'symbol') return undefined;
        return retrieveStaticData(hash, prop);
      },
    }
  );
}

/**
 * @param {string} hash
 * @param {string} prop
 */
function retrieveStaticData(hash, prop) {
  const { globalData } = getGlobalContext();
  /** @type {Record<string, StaticModule>} */
  const staticReturns = globalData.get('server:staticImports');
  const hashData = staticReturns[hash];
  // todo: handle dev mode re-request.
  const cachedData = hashData?.[prop];
  if (cachedData?.type === 'raw') {
    return cachedData.value;
  }

  if (cachedData?.type === 'function') {
    if (cachedData.isAsync) {
      return async () => {
        return cachedData.returnValue;
      };
    }
    return () => {
      return cachedData.returnValue;
    };
  }

  console.warn(`${hash}.${prop} was not available at build time.`);
  return null;
}
