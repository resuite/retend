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
 * @template T
 * Loads a value during SSR, serializes it into the server context,
 * and resumes it on the client.
 *
 * Use this inside `Cell.derivedAsync()` when you want an async computation
 * to reuse server-rendered data during hydration.
 *
 * @example
 * ```js
 * const user = Cell.derivedAsync(async () =>
 *   serverResource(
 *     ['user', userId],
 *     () => fetch(`/api/users/${userId}`).then((response) => response.json())
 *   )
 * );
 * ```
 *
 * @example
 * ```js
 * const greeting = Cell.derivedAsync(async (get) =>
 *   serverResource(['greeting', get(name)], () => `Hello ${get(name)}`)
 * );
 * ```
 *
 * @param {unknown} key
 * @param {() => T | Promise<T>} load
 * @returns {Promise<T>}
 */
export async function serverResource(key, load) {
  const map = getServerDataMap();
  const serializedKey = JSON.stringify(key);
  if (map.has(serializedKey)) return map.get(serializedKey);
  if (getGlobalContext().globalData.get('env:ssr')) {
    const pending = Promise.resolve(load()).then((value) => {
      map.set(serializedKey, value);
      return value;
    });
    map.set(serializedKey, pending);
    return pending;
  }
  return load();
}
