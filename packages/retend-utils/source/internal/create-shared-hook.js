import { useSetupEffect } from 'retend';
import { getGlobalContext, matchContext, Modes } from 'retend/context';

/**
 * @template T
 * @typedef {{[K in keyof T]: NonNullable<T[K]>}} NonNullableProps<T>
 */

/**
 * @typedef {`handle${string}`} ListenerName
 */

/**
 * @template out E
 * @typedef {Partial<Record<ListenerName, ((event: E) => void)>>} Data
 */

/**
 * A factory function to create a shared hook that manages a global state
 * with reference counting for event listeners.
 *
 * @template {Event} E - The type of event to listen for.
 * @template {object} T - The initial data type of the data stored in the global state.
 * @template  U - The return type of the hook.
 * @template {any[]} [Args=never]
 *
 * @param {object} options - The options to create the shared hook.
 * @param {symbol} options.key - A unique symbol to use as the key in the global store.
 * @param {() => T} options.initialData - A function that returns the initial data.
 * @param {(data: NonNullableProps<T & Data<E>>, window: Window) => void} options.setup - A function to run when the first hook instance is created (e.g., to add event listeners).
 * @param {(data: NonNullableProps<T & Data<E>>, window: Window) => void} options.teardown - A function to run when the last hook instance is destroyed (e.g., to remove event listeners).
 * @param {(data: NonNullableProps<T & Data<E>>, ...input: Args) => U} options.getValue - A function that returns the value from the hook.
 * @returns {((...args: Args) => U)} A new hook function.
 */
export function createSharedHook(options) {
  const { key, initialData, setup, teardown, getValue } = options;
  return (...args) => {
    const { globalData } = getGlobalContext();
    let data = globalData.get(key);
    if (!data) {
      data = { ...initialData(), count: 0 };
      globalData.set(key, data);
    }

    useSetupEffect(() => {
      const { window } = getGlobalContext();
      if (!matchContext(window, Modes.Interactive)) return;

      if (data.count === 0) setup(data, window);
      data.count++;

      return () => {
        data.count--;
        if (data.count === 0) teardown(data, window);
      };
    });

    return getValue(data, ...args);
  };
}
