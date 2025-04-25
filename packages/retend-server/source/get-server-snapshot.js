/** @import { StaticModule } from './types.js' */
import { getGlobalContext } from 'retend/context';

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
 * Helper type to check if a function can be serialized.
 *
 * @template F
 * @typedef {F extends (() =>  infer R | Promise<infer R>) ? Parameters<F>['length'] extends 0 ? IsSerializableValue<R> extends true ? true : false : false : false} IsSerializableFunction
 */

/**
 * Extracts serializable values and functions returning serializable Promises from a module.
 * Serializable values include strings, numbers, booleans, null, Dates, arrays of serializable values,
 * and objects with serializable values. Functions must return a Promise resolving to a serializable value.
 *
 * @template {object} M
 * @typedef {{
 *   [K in keyof M as IsSerializableFunction<M[K]> extends true ? K : IsSerializableValue<M[K]> extends true ? K : never]: M[K];
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
 * Calling a function on the returned object provides the *pre-computed result* captured
 * during build/SSR; the original function is *not* re-executed on the client.
 *
 * **Constraints:**
 * - The target module (`m`) is executed *only* during build/SSR .
 * - The function _must_ be called during build/SSR before it can be used in the client. If it is called conditionally, or for
 *   a module that was not previously executed during build/SSR, the returned data will be `null`.
 * - Only JSON-serializable data is transferred: raw values and the *resolved, serializable return values*
 *   of functions executed during build/SSR. Functions themselves Promises, Maps, Sets, etc., are not transferred.
 *
 * @template {Module} M - An object type representing the expected exports of the target module.
 * @param {() => Promise<M>} m - A function returning a dynamic `import()` pointing to the
 *   server/build-only module. This path is analyzed at build time.
 * @returns {Promise<SerializedModule<M>>} - A Promise resolving to an object containing the
 *   captured serializable data. Accessing properties yields captured values; calling
 *   functions yields their single, pre-computed result (async if the original was async).
 *
 * @example
 * // ===== config.server.js =====
 * // Server-only imports
 * import { randomUUID } from 'node:crypto';
 * import { readFileSync } from 'node:fs';
 * import { join } from 'node:path';
 *
 * // Export a simple serializable value
 * export const buildEnvironment = process.env.NODE_ENV || 'development';
 *
 * // Export a Date (will be serialized/deserialized)
 * export const generatedAt = new Date();
 *
 * // Export a synchronous function (must be called during build/SSR)
 * export function getBuildId() {
 *   console.log('[Build/SSR] Generating Build ID...');
 *   return randomUUID();
 * }
 *
 * export async function loadRemoteConfig() {
 *   console.log('[Build/SSR] Loading remote config...');
 *   await new Promise(resolve => setTimeout(resolve, 50));
 *   try {
 *      const configPath = join(process.cwd(), 'app.config.json');
 *      const rawConfig = readFileSync(configPath, 'utf-8');
 *      const configData = JSON.parse(rawConfig);
 *      console.log('[Build/SSR] Remote config loaded.');
 *      return { success: true, data: configData };
 *   } catch (error) {
 *      console.error('[Build/SSR] Failed to load remote config:', error.message);
 *      return { success: false, error: error.message || 'Failed to load.' };
 *   }
 * }
 *
 * // This function takes arguments, so its result cannot be snapshotted by getServerSnapshot
 * export function formatMessage(template) {
 *   return template.replace('%TIME%', new Date().toLocaleTimeString());
 * }
 *
 * // ===== App.jsx =====
 * import { getServerSnapshot } from 'retend-server/client';
 *
 * export async function MyComponent() {
 *   const snapshot = await getServerSnapshot(() => import('./config.server.js'));
 *   const environment = snapshot.buildEnvironment;
 *   const generationTime = snapshot.generatedAt;
 *   const buildId = snapshot.getBuildId();
 *   const remoteConfigResult = await snapshot.loadRemoteConfig();
 *
 *   return (
 *     <div className="app-container">
 *       <h1>Application Status</h1>
 *       <p>Running in: <strong>{environment}</strong> mode.</p>
 *       <p>Build ID: <code>{buildId}</code></p>
 *       <p>Generated At: {generationTime.toLocaleString()}</p>
 *     </div>
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
          const type = value instanceof Date ? 'date' : 'raw';
          moduleCache[key] = { type, value: parsedValue };
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

  if (cachedData?.type === 'date') {
    return new Date(cachedData.value);
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

  console.error(`(${hash}).${prop} was not available at build time.`);
  return null;
}
