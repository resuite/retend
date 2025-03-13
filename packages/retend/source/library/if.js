/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import * as VDom from '../v-dom/index.js' */
/** @import { ReactiveCellFunction } from './utils.js' */

import { Cell } from '@adbl/cells';
import {
  addCellListener,
  createCommentPair,
  generateChildNodes,
  getMostCurrentFunction,
} from './utils.js';
import { linkNodesToComponent } from '../plugin/index.js';

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
  if (!Cell.isCell(value)) {
    if (typeof fnOrObject === 'function') {
      const func = getMostCurrentFunction(fnOrObject);
      if (value) {
        return func(value);
      }
      if (elseFn) {
        const elseFunc = getMostCurrentFunction(elseFn);
        return elseFunc();
      }
      return;
    }

    if (typeof fnOrObject === 'object') {
      if (value && 'true' in fnOrObject) {
        return getMostCurrentFunction(fnOrObject.true)(value);
      }

      if (!value && 'false' in fnOrObject) {
        return getMostCurrentFunction(fnOrObject.false)();
      }
    }

    console.error(
      'If expects a callback or condition object as the second argument.'
    );
    return;
  }

  const [rangeStart, rangeEnd] = createCommentPair();

  /** @type {ReactiveCellFunction<T, typeof rangeStart, (Node | VDom.VNode)[]>} */
  const callback = function (value) {
    /** @type {(Node | VDom.VNode)[]} */
    let nodes = [];
    let nextNode = this.nextSibling;
    while (
      nextNode &&
      !(
        '__commentRangeSymbol' in nextNode &&
        nextNode.__commentRangeSymbol === this.__commentRangeSymbol
      )
    ) {
      nextNode.remove();
      nextNode = this.nextSibling;
    }

    if (typeof fnOrObject === 'function') {
      if (value) {
        const func = getMostCurrentFunction(fnOrObject);
        nodes = generateChildNodes(func(value));
        linkNodesToComponent(nodes, func, value);
      } else if (elseFn) {
        const elseFunc = getMostCurrentFunction(elseFn);
        nodes = generateChildNodes(elseFunc());
        linkNodesToComponent(nodes, elseFunc);
      } else {
        nodes = [];
      }
    } else if (typeof fnOrObject === 'object') {
      if (value && 'true' in fnOrObject) {
        const trueFunc = getMostCurrentFunction(fnOrObject.true);
        nodes = generateChildNodes(trueFunc(value));
        linkNodesToComponent(nodes, trueFunc, value);
      } else if (!value && 'false' in fnOrObject) {
        const falseFunc = getMostCurrentFunction(fnOrObject.false);
        nodes = generateChildNodes(falseFunc());
        linkNodesToComponent(nodes, falseFunc);
      } else {
        nodes = [];
      }
    } else
      console.error(
        'If expects a callback or condition object as the second argument.'
      );

    this.after(.../** @type {*} */ (nodes));
    return nodes;
  };

  // see comment in switch.js
  const firstRun = callback.bind(rangeStart)(value.value);
  addCellListener(rangeStart, value, callback, false);
  return [rangeStart, ...firstRun, rangeEnd];
}
