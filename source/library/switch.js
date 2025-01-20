import { Cell } from '@adbl/cells';
import {
  createCommentPair,
  generateChildNodes,
  getMostCurrentFunction,
} from './utils.js';
import { linkNodesToComponent } from '../render/index.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * Renders a dynamic switch-case construct using a reactive value or static value.
 *
 * @template {string | number | symbol} S
 * @template {((value: S) => JSX.Template) | never | undefined} D
 * @param {Cell<S> | S} value - A reactive `Cell` or a static value to determine the active case.
 * @param {D extends ((value: S) => JSX.Template) ? Partial<Record<S, D>> : Record<S, D>} cases - An object mapping possible values to JSX.Template-generating functions.
 * @param {D} [defaultCase] - Optional function to generate JSX.Template if the value doesn't match any key in `cases`.
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
  const [rangeStart, rangeEnd] = createCommentPair();

  if (!Cell.isCell(value)) {
    if (value in cases && cases[value]) {
      const fn = getMostCurrentFunction(cases[value]);
      const nodes = generateChildNodes(fn());
      linkNodesToComponent(nodes, fn);
      return nodes;
    }

    if (defaultCase) {
      const defaultCaseFunc = getMostCurrentFunction(defaultCase);
      const nodes = generateChildNodes(defaultCaseFunc(value));
      linkNodesToComponent(nodes, defaultCaseFunc, value);
      return nodes;
    }

    return null;
  }

  /** @param {S} value */
  const callback = (value) => {
    /** @type {Node[]} */
    let nodes = [];
    let nextNode = rangeStart.nextSibling;
    while (nextNode && nextNode !== rangeEnd) {
      nextNode.remove();
      nextNode = rangeStart.nextSibling;
    }

    const caseCaller = cases[value];
    if (caseCaller) {
      const caseCallerFunc = getMostCurrentFunction(caseCaller);
      nodes = generateChildNodes(caseCallerFunc(value));
      linkNodesToComponent(nodes, caseCallerFunc, value);
      rangeStart.after(...nodes);
      return nodes;
    }

    if (defaultCase) {
      const defaultCaseFunc = getMostCurrentFunction(defaultCase);
      nodes = generateChildNodes(defaultCaseFunc(value));
      linkNodesToComponent(nodes, defaultCaseFunc, value);
      rangeStart.after(...nodes);
      return nodes;
    }

    return nodes;
  };

  // Prevents premature garbage collection.
  const persistedSet = new Set();
  persistedSet.add(value);
  persistedSet.add(callback);
  Reflect.set(rangeStart, '__attributeCells', persistedSet);

  // Don't use runAndListen with an outer array to store nodes.
  // It leads to a memory leak.
  const firstRun = callback(value.value);
  value.listen(callback, { weak: true });
  return [rangeStart, ...firstRun, rangeEnd];
}
