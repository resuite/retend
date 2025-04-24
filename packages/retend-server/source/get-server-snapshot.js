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
 * A macro that allows you to accesses static async functions, generated at build time,
 * from a corresponding server or build-only module.
 *
 * @template {Module} M The type definition of the module being imported.
 * @param {ModuleImporter<M>} m Function returning a dynamic `import()` to the server module
 *   (e.g., `() => import('./cards.server.ts')`).
 *
 * @returns {SerializedModule<M>} A Promise resolving to an object containing statically retrieved data from the module.
 * The data imported would have been generated during build time and embedded into the document.
 *
 * @example
 * // In a server module (posts.ts):
 * export async function getPosts() {
 *   return [
 *     { id: 1, title: 'Hello World' },
 *     { id: 2, title: 'Goodbye World' },
 *   ]
 * }
 *
 * // In your client-side component:
 * export default function Posts() {
 *   const { getPosts } = await getServerSnapshot(() => import('./posts.ts'));
 *   const posts = await getPosts(); // Resolves at build-time.
 *
 *   return <ul>{For(posts, (post) => <li>{post.title}</li>)}</ul>;
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
