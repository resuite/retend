import { Cell } from '@adbl/cells';
import { generateChildNodes } from './utils.js';

/**
 * Conditionally renders nodes based on the truthiness of a value.
 *
 * @template T
 * @param {T | Cell<T>} value
 * @param {(value: NonNullable<T>) => JSX.Template} fn
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
export function If(value, fn, elseFn) {
  /** @type {Node[]} */
  let nodes = [];

  if (!Cell.isCell(value)) {
    if (value) {
      return fn(value);
    }

    if (elseFn) {
      return elseFn();
    }

    return;
  }

  const rangeStart = window.document.createComment('----');
  const rangeEnd = window.document.createComment('----');

  /** @param {T} value */
  const callback = (value) => {
    let nextNode = rangeStart.nextSibling;
    while (nextNode && nextNode !== rangeEnd) {
      nextNode.remove();
      nextNode = rangeStart.nextSibling;
    }

    if (value) {
      nodes = generateChildNodes(fn(value));
    } else if (elseFn) {
      nodes = generateChildNodes(elseFn());
    } else {
      nodes = [];
    }
    rangeStart.after(...nodes);
  };

  Reflect.set(rangeStart, '__persisted', callback); // prevents garbage collection.

  value.runAndListen(callback, { weak: true });
  return [rangeStart, ...nodes, rangeEnd];
}
