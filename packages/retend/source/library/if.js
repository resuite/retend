/** @import { JSX } from '../jsx-runtime/types.ts' */

import { Cell, AsyncCell } from '@adbl/cells';

import { useAwait } from './await.js';
import { getActiveRenderer } from './renderer.js';
import { branchState, withState } from './scope.js';
import { linkNodes } from './utils.js';

/**
 * @template T
 * @typedef {Record<'true', ((value: T) => JSX.Template)>
 * | Record<'false',  (() => JSX.Template)>
 * | {
 *   true:  ((value: T) => JSX.Template),
 *   false:  (() => JSX.Template)
 * }} ConditionObject
 */

/**
 * Extracts the resolved value type from a cell type.
 * For AsyncCell<Promise<T>>, returns T.
 * For Cell<T>, returns T.
 * For T, returns T.
 * @template T
 * @typedef {Awaited<T extends AsyncCell<infer U> ? U : T extends Cell<infer V> ? V : T>} ResolvedCellValue
 */

/**
 * Conditionally renders nodes based on the truthiness of a value.
 *
 * @template T
 * @param {T | AsyncCell<T> | Cell<T>} value
 * @param {( ((value: NonNullable<ResolvedCellValue<T>>) => JSX.Template)) | ConditionObject<ResolvedCellValue<T>>} fnOrObject
 * @param { (() => JSX.Template)} [elseFn] - Optional callback for falsy values
 * @returns {JSX.Template}
 *
 * @example
 * import { Cell } from '@adbl/cells';
 * // Create a reactive cell with a boolean value
 * const isLoggedIn = Cell.source(false);
 *
 * // Use renderIf to conditionally render a welcome message
 * const message = If(isLoggedIn, {
 *   true: () => <div>Welcome, user!</div>,
 *   false: () => <div>Please log in.</div>
 * });
 *
 * document.body.append(...renderer.render(message));
 *
 * // Later, when the user logs in, update the cell
 * isLoggedIn.set(true);
 * // The welcome message will now be displayed
 */
export function If(value, fnOrObject, elseFn) {
  return () => {
    const renderer = getActiveRenderer();
    if (!Cell.isCell(value)) {
      if (typeof fnOrObject === 'function') {
        if (!fnOrObject.name) {
          Object.defineProperty(fnOrObject, 'name', { value: 'If.True' });
        }
        if (value) {
          return renderer.handleComponent(fnOrObject, [value]);
        }
        if (elseFn) {
          return renderer.handleComponent(elseFn, []);
        }
        return;
      }

      if (typeof fnOrObject === 'object') {
        if (value && 'true' in fnOrObject) {
          return renderer.handleComponent(fnOrObject.true, [value]);
        }

        if (!value && 'false' in fnOrObject) {
          return renderer.handleComponent(fnOrObject.false, []);
        }
      }

      console.error(
        'If expects a callback or condition object as the second argument.'
      );
      return;
    }

    const stateSnapshot = branchState();
    if (value instanceof AsyncCell) useAwait()?.waitUntil(value);

    if (typeof fnOrObject === 'function' && !fnOrObject.name) {
      Object.defineProperty(fnOrObject, 'name', { value: 'If.True' });
    }

    /** @param {T} _value */
    const callback = (_value) => {
      return withState(stateSnapshot, () => {
        if (typeof fnOrObject === 'function') {
          if (_value) {
            const newNodes = renderer.handleComponent(
              fnOrObject,
              [_value],
              stateSnapshot
            );
            return Array.isArray(newNodes) ? newNodes : [newNodes];
          }
          if (elseFn) {
            const newNodes = renderer.handleComponent(
              elseFn,
              [],
              stateSnapshot
            );
            return Array.isArray(newNodes) ? newNodes : [newNodes];
          }
          return [];
        }

        if (typeof fnOrObject === 'object') {
          if (_value && 'true' in fnOrObject) {
            const newNodes = renderer.handleComponent(
              fnOrObject.true,
              [_value],
              stateSnapshot
            );
            return Array.isArray(newNodes) ? newNodes : [newNodes];
          }

          if (!_value && 'false' in fnOrObject) {
            const newNodes = renderer.handleComponent(
              fnOrObject.false,
              [],
              stateSnapshot
            );
            return Array.isArray(newNodes) ? newNodes : [newNodes];
          }

          return [];
        }
        console.error(
          'If expects a callback or condition object as the second argument.'
        );
        return [];
      });
    };

    /** @type {ReturnType<typeof renderer.createGroupHandle>} */
    let handle;

    /**
     * @param {T} nextValue
     */
    const processValueChange = (nextValue) => {
      stateSnapshot.node.dispose();
      const results = callback(nextValue);
      renderer.write(handle, results);
      renderer.observer?.flush();
      stateSnapshot.node.activate();
    };

    // It is important that the listener is registered first.
    value.listen((nextValue) => {
      if (nextValue instanceof Promise) nextValue.then(processValueChange);
      else processValueChange(nextValue);
    });

    const initialValue = value.get();

    if (initialValue instanceof Promise) {
      const group = renderer.createGroup();
      handle = renderer.createGroupHandle(group);
      initialValue.then((resolved) => processValueChange(resolved));
      return group;
    }

    const initialResults = callback(initialValue);
    const group = renderer.createGroup();
    const nodes = Array.isArray(initialResults)
      ? initialResults
      : [initialResults];
    for (const child of nodes) linkNodes(group, child, renderer);
    handle = renderer.createGroupHandle(group);
    return group;
  };
}
