/** @import { JSX } from '../jsx-runtime/types.ts' */

import { Cell } from '@adbl/cells';
import { h } from './jsx.js';
import { createScopeSnapshot, withScopeSnapshot } from './scope.js';
import { ArgumentList } from './utils.js';
import { getActiveRenderer } from './renderer.js';
import { IgnoredHProps } from '../_internals.js';

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
 * document.body.append(...message);
 *
 * // Later, when the user logs in, update the cell
 * isLoggedIn.set(true);
 * // The welcome message will now be displayed
 */
export function If(value, fnOrObject, elseFn) {
  const renderer = getActiveRenderer();
  if (!Cell.isCell(value)) {
    if (typeof fnOrObject === 'function') {
      if (value) {
        return h(
          fnOrObject,
          new ArgumentList([value]),
          ...IgnoredHProps,
          renderer
        );
      }
      if (elseFn) {
        return h(elseFn, new ArgumentList([]), ...IgnoredHProps, renderer);
      }
      return;
    }

    if (typeof fnOrObject === 'object') {
      if (value && 'true' in fnOrObject) {
        return h(
          fnOrObject.true,
          new ArgumentList([value]),
          ...IgnoredHProps,
          renderer
        );
      }

      if (!value && 'false' in fnOrObject) {
        return h(
          fnOrObject.false,
          new ArgumentList([]),
          ...IgnoredHProps,
          renderer
        );
      }
    }

    console.error(
      'If expects a callback or condition object as the second argument.'
    );
    return;
  }

  const scopeSnapshot = createScopeSnapshot();

  /** @param {T} _value */
  const callback = (_value) => {
    return withScopeSnapshot(scopeSnapshot, () => {
      if (typeof fnOrObject === 'function') {
        if (_value) {
          const newNodes = h(
            fnOrObject,
            new ArgumentList([_value]),
            ...IgnoredHProps,
            renderer
          );
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }
        if (elseFn) {
          const newNodes = h(
            elseFn,
            new ArgumentList([]),
            ...IgnoredHProps,
            renderer
          );
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }
        return [];
      }

      if (typeof fnOrObject === 'object') {
        if (_value && 'true' in fnOrObject) {
          const newNodes = h(
            fnOrObject.true,
            new ArgumentList([_value]),
            ...IgnoredHProps,
            renderer
          );
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }

        if (!_value && 'false' in fnOrObject) {
          const newNodes = h(
            fnOrObject.false,
            new ArgumentList([]),
            ...IgnoredHProps,
            renderer
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

  // It is important that the listener is registered first.
  value.listen((nextValue) => {
    scopeSnapshot.node.dispose();
    const results = callback(nextValue);
    renderer.write(handle, results);
    scopeSnapshot.node.activate();
  });

  const initialResults = callback(value.get());
  const group = renderer.createGroup(initialResults);
  const handle = renderer.createGroupHandle(group);
  return group;
}
