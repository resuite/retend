import { Cell } from '@adbl/cells';
import { generateChildNodes } from './utils.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * Renders a dynamic switch-case construct using a reactive value or static value.
 *
 * @template {string | number | symbol} T
 * @param {Cell<T> | T} value - A reactive `Cell` or a static value to determine the active case.
 * @param {Record<T, () => JSX.Template>} cases - An object mapping possible values to JSX.Template-generating functions.
 * @param {(value: T) => JSX.Template} [defaultCase] - Optional function to generate JSX.Template if the value doesn't match any key in `cases`.
 * @returns {JSX.Template} A list of nodes that represent the selected case's template.
 *
 * @example
 * // Static usage
 * const staticResult = Switch('caseA', {
 *   caseA: () => <div>Case A</div>,
 *   caseB: () => <span>Case B</span>
 * });
 *
 * // Reactive usage
 * const reactiveCell = Cell.source('caseA');
 * const reactiveResult = Switch(reactiveCell, {
 *   caseA: () => <div>Case A</div>,
 *   caseB: () => <span>Case B</span>
 * });
 *
 * // With a default case
 * const staticWithDefault = Switch('caseC', {
 *   caseA: () => <div>Case A</div>,
 *   caseB: () => <span>Case B</span>
 * }, (value) => <p>Unknown case: {value}</p>);
 *
 * // Reactive with default
 * const reactiveWithDefault = Switch(reactiveCell, {
 *   caseA: () => <div>Case A</div>,
 *   caseB: () => <span>Case B</span>
 * }, (value) => <p>Unknown case: {value}</p>);
 *
 * // Resulting JSX output will dynamically update for reactiveCell based on its value.
 */
export function Switch(value, cases, defaultCase) {
  const rangeStart = globalThis.window.document.createComment('----');
  const rangeEnd = globalThis.window.document.createComment('----');
  /** @type {Node[]} */
  let nodes = [];

  if (!Cell.isCell(value)) {
    if (value in cases) {
      const nodes = generateChildNodes(cases[value]());
      return nodes;
    }

    if (defaultCase) {
      const nodes = generateChildNodes(defaultCase(value));
      return nodes;
    }

    return null;
  }

  /** @param {T} value*/
  const callback = (value) => {
    let nextNode = rangeStart.nextSibling;
    while (nextNode && nextNode !== rangeEnd) {
      nextNode.remove();
      nextNode = rangeStart.nextSibling;
    }

    const caseCaller = cases[value];
    if (caseCaller) {
      nodes = generateChildNodes(caseCaller());
      rangeStart.after(...nodes);
      return;
    }

    if (defaultCase) {
      nodes = generateChildNodes(defaultCase(value));
      rangeStart.after(...nodes);
      return;
    }
  };

  Reflect.set(rangeStart, '__persisted', callback); // prevents garbage collection.

  value.runAndListen(callback, { weak: true });
  return [rangeStart, ...nodes, rangeEnd];
}
