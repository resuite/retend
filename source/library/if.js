import { Cell } from '@adbl/cells';
import { generateChildNodes } from './utils.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * @template T
 * @typedef {Record<'true', (value: T) => JSX.Template>
 * | Record<'false', () => JSX.Template>
 * | {
 *   true: (value: T) =>JSX.Template,
 *   false: () => JSX.Template
 * }} ConditionObject
 */

/**
 * Conditionally renders nodes based on the truthiness of a value.
 *
 * @template T
 * @param {T | Cell<T>} value
 * @param {((value: NonNullable<T>) => JSX.Template) | ConditionObject<T>} fnOrObject
 * @param {() => JSX.Template} [elseFn] - Optional callback for falsy values
 * @returns {JSX.Template}
 *
 * @example
 * import { Cell } from '@adbl/cells';
 * // Create a reactive cell with a boolean value
 * const isLoggedIn = Cell.source(false);
 *
 * // Use renderIf to conditionally render a welcome message
 * const welcomeMessage = If(
 *  isLoggedIn,
 *  () => {
 *    const div = document.createElement('div');
 *    div.textContent = 'Welcome, user!';
 *    return div;
 *  },
 * () => {
 *    const div = document.createElement('div');
 *    div.textContent = 'Please log in.';
 *    return div;
 * });
 *
 * // Add the result to the DOM
 * document.body.append(...welcomeMessage);
 *
 * // Later, when the user logs in, update the cell
 * isLoggedIn.value = true;
 * // The welcome message will now be displayed
 */
export function If(value, fnOrObject, elseFn) {
  /** @type {Node[]} */
  let nodes = [];

  if (!Cell.isCell(value)) {
    if (typeof fnOrObject === 'function') {
      if (value) {
        return fnOrObject(value);
      }

      if (elseFn) {
        return elseFn();
      }

      return;
    }

    if (typeof fnOrObject === 'object') {
      if (value && 'true' in fnOrObject) {
        return fnOrObject.true(value);
      }

      if (!value && 'false' in fnOrObject) {
        return fnOrObject.false();
      }
    }

    console.error(
      'If expects a callback or condition object as the second argument.'
    );
    return;
  }

  const rangeStart = globalThis.window.document.createComment('----');
  const rangeEnd = globalThis.window.document.createComment('----');

  /** @param {T} value */
  const callback = (value) => {
    let nextNode = rangeStart.nextSibling;
    while (nextNode && nextNode !== rangeEnd) {
      nextNode.remove();
      nextNode = rangeStart.nextSibling;
    }

    if (typeof fnOrObject === 'function') {
      if (value) {
        nodes = generateChildNodes(fnOrObject(value));
      } else if (elseFn) {
        nodes = generateChildNodes(elseFn());
      } else {
        nodes = [];
      }
    } else if (typeof fnOrObject === 'object') {
      if (value && 'true' in fnOrObject) {
        nodes = generateChildNodes(fnOrObject.true(value));
      } else if (!value && 'false' in fnOrObject) {
        nodes = generateChildNodes(fnOrObject.false());
      } else {
        nodes = [];
      }
    } else
      console.error(
        'If expects a callback or condition object as the second argument.'
      );

    rangeStart.after(...nodes);
  };

  Reflect.set(rangeStart, '__persisted', callback); // prevents garbage collection.

  value.runAndListen(callback, { weak: true });
  return [rangeStart, ...nodes, rangeEnd];
}
