/** @import { JSX } from '../jsx-runtime/types.ts' */

import { Cell } from '@adbl/cells';
import { h } from './jsx.js';
import { createScopeSnapshot, withScopeSnapshot } from './scope.js';
import { ArgumentList } from './utils.js';
import { getActiveRenderer } from '../renderers/index.js';

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
 * Conditionally renders nodes based on the truthiness of a value.
 *
 * @template T
 * @param {T | Cell<T>} value
 * @param {( ((value: NonNullable<T>) => JSX.Template)) | ConditionObject<T>} fnOrObject
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
 * // Add the result to the DOM
 * document.body.append(...message);
 *
 * // Later, when the user logs in, update the cell
 * isLoggedIn.set(true);
 * // The welcome message will now be displayed
 */
export function If(value, fnOrObject, elseFn) {
  if (!Cell.isCell(value)) {
    if (typeof fnOrObject === 'function') {
      if (value) {
        return h(fnOrObject, new ArgumentList([value]));
      }
      if (elseFn) {
        return h(elseFn, new ArgumentList([]));
      }
      return;
    }

    if (typeof fnOrObject === 'object') {
      if (value && 'true' in fnOrObject) {
        return h(fnOrObject.true, new ArgumentList([value]));
      }

      if (!value && 'false' in fnOrObject) {
        return h(fnOrObject.false, new ArgumentList([]));
      }
    }

    console.error(
      'If expects a callback or condition object as the second argument.'
    );
    return;
  }

  const renderer = getActiveRenderer();
  const segment = renderer.createSegment();
  const scopeSnapshot = createScopeSnapshot();
  let isInitialRun = true;

  /** @param {T} _value */
  const callback = (_value) => {
    scopeSnapshot.node.dispose(); // cleanup previous effects
    const results = withScopeSnapshot(scopeSnapshot, () => {
      if (typeof fnOrObject === 'function') {
        if (_value) {
          const newNodes = h(fnOrObject, new ArgumentList([_value]));
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }
        if (elseFn) {
          const newNodes = h(elseFn, new ArgumentList([]));
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }
        return [];
      }

      if (typeof fnOrObject === 'object') {
        if (_value && 'true' in fnOrObject) {
          const newNodes = h(fnOrObject.true, new ArgumentList([_value]));
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }

        if (!_value && 'false' in fnOrObject) {
          const newNodes = h(fnOrObject.false, new ArgumentList([]));
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }

        return [];
      }
      console.error(
        'If expects a callback or condition object as the second argument.'
      );
      return [];
    });
    renderer.updateSegment(segment, results);
    if (!isInitialRun) scopeSnapshot.node.activate();
    else isInitialRun = false;
  };

  value.runAndListen(callback);
  return segment;
}
