import { Cell } from 'retend';
import { getGlobalContext } from 'retend/context';

const ServerDataKey = Symbol.for('retend:server-data');

/**
 * @returns {Map<string, any>}
 */
function getServerDataMap() {
  const { globalData } = getGlobalContext();
  let map = globalData.get(ServerDataKey);
  if (!map) {
    map = new Map();
    globalData.set(ServerDataKey, map);
  }
  return map;
}

export function getServerDataValues() {
  return new Map(getServerDataMap());
}

/**
 * @param {Map<string, any>} values
 */
export function setServerDataValues(values) {
  const map = getServerDataMap();
  map.clear();
  for (const [key, value] of values) {
    map.set(key, value);
  }
}

/**
 * Creates an async cell whose initial value can be produced during SSR,
 * serialized into the server context, and then resumed on the client.
 *
 * The `key` callback defines the cache identity. Any reactive values read
 * there become the dependency boundary for reuse and refetching.
 *
 * @example
 * ```js
 * const user = serverResource(
 *   () => ['user', userId],
 *   () => fetch(`/api/users/${userId}`).then((response) => response.json())
 * );
 * ```
 *
 * @example
 * ```js
 * const greeting = serverResource(
 *   (get) => ['greeting', get(name)],
 *   (get) => `Hello ${get(name)}`
 * );
 * ```
 *
 * @param {(get: <T>(cell: import('retend').Cell<T>) => T) => unknown} key
 * @param {(get: <T>(cell: import('retend').Cell<T>) => T) => unknown | Promise<unknown>} load
 */
export function serverResource(key, load) {
  return Cell.derivedAsync(async (get) => {
    const map = getServerDataMap();
    const serializedKey = JSON.stringify(key(get));
    if (map.has(serializedKey)) return map.get(serializedKey);
    if (getGlobalContext().globalData.get('env:ssr')) {
      const pending = Promise.resolve(load(get)).then((value) => {
        map.set(serializedKey, value);
        return value;
      });
      map.set(serializedKey, pending);
      return pending;
    }
    return load(get);
  });
}
