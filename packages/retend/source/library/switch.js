/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import * as VDom from '../v-dom/index.js' */
/** @import { ReactiveCellFunction } from './utils.js' */

import { Cell } from '@adbl/cells';
import { addCellListener, ArgumentList, createCommentPair } from './utils.js';
import { createScopeSnapshot, withScopeSnapshot } from './scope.js';
import h from './jsx.js';

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
      const nodes = h(cases[value], new ArgumentList([]));
      return nodes;
    }

    if (defaultCase) {
      const nodes = h(defaultCase, new ArgumentList([value]));
      return nodes;
    }

    return undefined;
  }

  const snapshot = createScopeSnapshot();
  let isInitialRun = true;

  /** @type {ReactiveCellFunction<ReturnType<typeof value.get>, typeof rangeStart, (Node | VDom.VNode)[]>} */
  const callback = function (value) {
    snapshot.node.dispose();
    const results = withScopeSnapshot(snapshot, () => {
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
        const newNodes = h(caseCaller, new ArgumentList([value]));
        nodes = Array.isArray(newNodes) ? newNodes : [newNodes];
        this.after(.../** @type {*} */ (nodes));
        return nodes;
      }

      if (defaultCase) {
        const newNodes = h(defaultCase, new ArgumentList([value]));
        nodes = Array.isArray(newNodes) ? newNodes : [newNodes];
        this.after(.../** @type {*} */ (nodes));
        return nodes;
      }

      return nodes;
    });
    if (!isInitialRun) snapshot.node.activate();
    else isInitialRun = false;
    return results;
  };

  // Don't use runAndListen with an outer array to store nodes.
  // It leads to a memory leak.
  const firstRun = callback.bind(rangeStart)(value.get());
  addCellListener(rangeStart, value, callback, false);
  return [rangeStart, ...firstRun, rangeEnd];
}

/**
 * Renders a dynamic switch-case construct using a reactive value or static value.
 *
 * @template {object} Obj
 * @template {keyof Obj} Key
 * @template {Obj[Key]} Value
 * @template {{ [Selected in Extract<Value, PropertyKey>]: (value: Extract<Obj, Record<Key, Selected>>) => JSX.Template }} Cases
 * @template {Partial<Cases>} DefinedCases
 * @overload
 * @param {Cell<Obj | null | undefined> | Obj | null | undefined} value - A reactive `Cell` or a static value to determine the active case.
 * @param {Key} key - The key of the object or cell to switch against.
 * @param {DefinedCases} cases - An object mapping possible values to template-generating functions.
 * @param {(value: Exclude<Obj, Record<Key, keyof DefinedCases>>) => JSX.Template} defaultCase
 * @returns {JSX.Template} A list of nodes that represent the selected case's template.
 */

/**
 * @template {object} Obj
 * @template {keyof Obj} Key
 * @template {Obj[Key]} Value
 * @template {{ [Selected in Extract<Value, PropertyKey>]: (value: Extract<Obj, Record<Key, Selected>>) => JSX.Template }} Cases
 * @overload
 * @param {Cell<Obj | null | undefined> | Obj | null | undefined} value - A reactive `Cell` or a static value to determine the active case.
 * @param {Key} key - The key of the object or cell to switch against.
 * @param {Required<Cases>} cases - An object mapping possible values to template-generating functions.
 * @returns {JSX.Template} A list of nodes that represent the selected case's template.
 */

/**
 * @param {*} value
 * @param {*} key
 * @param {*} cases
 * @param {*} [defaultCase]
 */
Switch.OnProperty = (value, key, cases, defaultCase) => {
  const [rangeStart, rangeEnd] = createCommentPair();

  if (!Cell.isCell(value)) {
    const discriminant = value[key];

    if (discriminant in cases && cases[discriminant]) {
      const nodes = h(cases[discriminant], new ArgumentList([value]));
      return nodes;
    }

    if (defaultCase) {
      const nodes = h(defaultCase, new ArgumentList([value]));
      return nodes;
    }

    return undefined;
  }

  // Reactive path
  const cell = value;
  const snapshot = createScopeSnapshot();

  /** @type {ReactiveCellFunction<any, any, any>} */
  const callback = function (cellValue) {
    snapshot.node.dispose();
    const results = withScopeSnapshot(snapshot, () => {
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

      const discriminant = cellValue[key];

      const caseCaller = cases[discriminant];
      if (caseCaller) {
        const newNodes = h(caseCaller, new ArgumentList([cellValue]));
        nodes = Array.isArray(newNodes) ? newNodes : [newNodes];
        this.after(.../** @type {*} */ (nodes));
        return nodes;
      }

      if (defaultCase) {
        const newNodes = h(defaultCase, new ArgumentList([cellValue]));
        nodes = Array.isArray(newNodes) ? newNodes : [newNodes];
        this.after(.../** @type {*} */ (nodes));
        return nodes;
      }

      return nodes;
    });
    if (this.isConnected) snapshot.node.activate();
    return results;
  };

  const firstRun = callback.bind(rangeStart)(cell.get());
  addCellListener(rangeStart, cell, callback, false);
  return [rangeStart, ...firstRun, rangeEnd];
};
