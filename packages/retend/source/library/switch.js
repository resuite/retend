/** @import { JSX } from '../jsx-runtime/types.ts' */

import { Cell } from '@adbl/cells';
import { ArgumentList } from './utils.js';
import { createScopeSnapshot, withScopeSnapshot } from './scope.js';
import h from './jsx.js';
import { getActiveRenderer } from '../renderers/index.js';

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
  const renderer = getActiveRenderer();
  const segment = renderer.createSegment();
  let isInitialRun = true;

  /** @param {any} value */
  const callback = (value) => {
    snapshot.node.dispose();
    const results = withScopeSnapshot(snapshot, () => {
      const caseCaller = cases[value];
      if (caseCaller) {
        const newNodes = h(caseCaller, new ArgumentList([value]));
        return Array.isArray(newNodes) ? newNodes : [newNodes];
      }

      if (defaultCase) {
        const newNodes = h(defaultCase, new ArgumentList([value]));
        return Array.isArray(newNodes) ? newNodes : [newNodes];
      }
      return [];
    });
    renderer.overwriteSegment(segment, results);
    if (!isInitialRun) snapshot.node.activate();
    else isInitialRun = false;
  };

  value.runAndListen(callback);
  return segment;
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
  let isInitialRun = false;
  const snapshot = createScopeSnapshot();
  const renderer = getActiveRenderer();
  const segment = renderer.createSegment();

  /** @param {any} cellValue */
  const callback = (cellValue) => {
    snapshot.node.dispose();
    const results = withScopeSnapshot(snapshot, () => {
      const discriminant = cellValue[key];

      const caseCaller = cases[discriminant];
      if (caseCaller) {
        const newNodes = h(caseCaller, new ArgumentList([cellValue]));
        return Array.isArray(newNodes) ? newNodes : [newNodes];
      }

      if (defaultCase) {
        const newNodes = h(defaultCase, new ArgumentList([cellValue]));
        return Array.isArray(newNodes) ? newNodes : [newNodes];
      }

      return [];
    });
    renderer.overwriteSegment(segment, results);
    if (!isInitialRun) snapshot.node.activate();
    else isInitialRun = false;
  };

  value.runAndListen(callback);
  return segment;
};
