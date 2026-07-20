/** @import { JSX } from '../jsx-runtime/types.ts' */

import { Cell, AsyncCell } from '@adbl/cells';

import { useAwait } from './await.js';
import { getActiveRenderer } from './renderer.js';
import { branchState, withState } from './scope.js';

/**
 * @template T
 * @typedef {Record<'true', ((value: NonNullable<T>) => JSX.Template)>
 * | Record<'false',  (() => JSX.Template)>
 * | {
 *   true:  ((value: NonNullable<T>) => JSX.Template),
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
    const callback = (_value) =>
      withState(stateSnapshot, () => {
        let caller;
        if (typeof fnOrObject === 'function') {
          caller = _value ? fnOrObject : elseFn;
          if (!caller) return [];
        } else if (typeof fnOrObject === 'object') {
          if (_value && 'true' in fnOrObject) caller = fnOrObject.true;
          else if (!_value && 'false' in fnOrObject) caller = fnOrObject.false;
          else return [];
        } else {
          console.error(
            'If expects a callback or condition object as the second argument.'
          );
          return [];
        }
        const nodes = renderer.handleComponent(
          caller,
          _value ? [_value] : [],
          stateSnapshot
        );
        return [nodes].flat();
      });

    /**
     * @param {T} nextValue
     */
    const processValueChange = (nextValue) => {
      stateSnapshot.node.dispose();
      renderer.write(handle, callback(nextValue));
      renderer.observer?.flush();
      stateSnapshot.node.activate();
    };

    // It is important that the listener is registered first.
    value.listen((nextValue) => {
      if (nextValue instanceof Promise) nextValue.then(processValueChange);
      else processValueChange(nextValue);
    });

    const initialValue = value.get();
    const group = renderer.createGroup();
    const handle = renderer.createGroupHandle(group);
    stateSnapshot.data = { handle };

    if (initialValue instanceof Promise) {
      initialValue.then(processValueChange);
      return group;
    }

    renderer.write(handle, callback(initialValue));
    return group;
  };
}
