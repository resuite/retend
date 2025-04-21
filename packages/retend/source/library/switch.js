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
 * Renders a dynamic switch-case construct using a reactive value or static value.
 *
 * @example
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
 * @template {string | number | symbol} Discriminant
 * @overload
 * @param {Cell<Discriminant | null | undefined> | Discriminant | null | undefined} value - A reactive `Cell` or a static value to determine the active case.
 * @param {Partial<Record<Discriminant, () => JSX.Template>>} cases - An object mapping possible values to template-generating functions.
 * @param {(value: Discriminant) => JSX.Template} defaultCase - Optional function to generate JSX.Template if the value doesn't match any key in `cases`.
 * @returns {JSX.Template} A list of nodes that represent the selected case's template.
 *
 */

/**
 * Renders a dynamic switch-case construct using a reactive value or static value.
 *
 * @example
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
 * @template {string | number | symbol} Discriminant
 * @overload
 * @param {Cell<Discriminant | null | undefined> | Discriminant | null | undefined} value - A reactive `Cell` or a static value to determine the active case.
 * @param {Record<Discriminant, () => JSX.Template>} cases - An object mapping possible values to template-generating functions.
 * @returns {JSX.Template} A list of nodes that represent the selected case's template.
 */

/**
 * @param {*} value
 * @param {*} cases
 * @param {*} [defaultCase]
 */
export function Switch(value, cases, defaultCase) {
  const [rangeStart, rangeEnd] = createCommentPair();

  if (!Cell.isCell(value)) {
    if (value in cases && cases[value]) {
      const fn = getMostCurrentFunction(cases[value]);
      const nodes = generateChildNodes(fn());
      linkNodesToComponent(nodes, fn);
      // Allows compatibility with the For and If functions,
      // where one root node is produced if the template is a single node.
      return nodes.length === 1 ? nodes[0] : nodes;
    }

    if (defaultCase) {
      const defaultCaseFunc = getMostCurrentFunction(defaultCase);
      const nodes = generateChildNodes(defaultCaseFunc(value));
      linkNodesToComponent(nodes, defaultCaseFunc, value);
      // Allows compatibility with the For and If functions,
      // where one root node is produced if the template is a single node.
      return nodes.length === 1 ? nodes[0] : nodes;
    }

    return undefined;
  }

  /** @type {ReactiveCellFunction<typeof value.value, typeof rangeStart, (Node | VDom.VNode)[]>} */
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

    const caseCaller = cases[value];
    if (caseCaller) {
      const caseCallerFunc = getMostCurrentFunction(caseCaller);
      nodes = generateChildNodes(caseCallerFunc(value));
      linkNodesToComponent(nodes, caseCallerFunc, value);
      this.after(.../** @type {*} */ (nodes));
      return nodes;
    }

    if (defaultCase) {
      const defaultCaseFunc = getMostCurrentFunction(defaultCase);
      nodes = generateChildNodes(defaultCaseFunc(value));
      linkNodesToComponent(nodes, defaultCaseFunc, value);
      this.after(.../** @type {*} */ (nodes));
      return nodes;
    }

    return nodes;
  };

  // Don't use runAndListen with an outer array to store nodes.
  // It leads to a memory leak.
  const firstRun = callback.bind(rangeStart)(value.value);
  addCellListener(rangeStart, value, callback, false);
  return [rangeStart, ...firstRun, rangeEnd];
}
