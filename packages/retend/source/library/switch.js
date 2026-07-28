/** @import { JSX } from '../jsx-runtime/types.ts' */

import { Cell, AsyncCell } from '@adbl/cells';

import { useAwait } from './await.js';
import { getActiveRenderer } from './renderer.js';
import { branchState, withState } from './scope.js';

/**
 * @param {*} value
 * @param {*} cases
 * @param {*} defaultCase
 * @param {*} key
 */
function createSwitch(value, cases, defaultCase, key) {
  return () => {
    const renderer = getActiveRenderer();

    for (const fn of Object.values(cases)) {
      if (typeof fn === 'function' && !fn.name)
        Object.defineProperty(fn, 'name', { value: 'Switch.Case' });
    }

    /** @param {any} current */
    const select = (current) => (key === null ? current : current[key]);
    if (!Cell.isCell(value)) {
      const caller = cases[select(value)];
      if (caller)
        return renderer.handleComponent(caller, key === null ? [] : [value]);
      return defaultCase
        ? renderer.handleComponent(defaultCase, [value])
        : undefined;
    }

    const snapshot = branchState();
    if (value instanceof AsyncCell) useAwait()?.waitUntil(value);

    /** @param {any} current */
    const callback = (current) =>
      withState(snapshot, () => {
        const caller = cases[select(current)] || defaultCase;
        if (!caller) return [];
        return [renderer.handleComponent(caller, [current], snapshot)].flat();
      });
    /** @param {any} nextValue */
    const processValueChange = (nextValue) => {
      snapshot.node.dispose();
      renderer.write(handle, callback(nextValue));
      renderer.observer?.flush();
      snapshot.node.activate();
    };

    // It is important that the listener is registered first.
    value.listen((nextValue) => {
      if (nextValue instanceof Promise) nextValue.then(processValueChange);
      else processValueChange(nextValue);
    });

    const initialValue = value.get();
    const group = renderer.createGroup();
    const handle = renderer.createGroupHandle(group);
    snapshot.data = { handle };
    if (initialValue instanceof Promise) {
      initialValue.then(processValueChange);
      return group;
    }
    renderer.write(handle, callback(initialValue));
    return group;
  };
}

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
 * @param {AsyncCell<Discriminant | null | undefined> | Cell<Discriminant | null | undefined> | Discriminant | null | undefined} value - A reactive `Cell` or a static value to determine the active case.
 * @param {Partial<Record<Discriminant, () => JSX.Template>>} cases - An object mapping possible values to template-generating functions.
 * @param {(value: Discriminant) => JSX.Template} defaultCase - Optional function to generate JSX.Template if the value doesn't match any key in `cases`.
 * @returns {JSX.Template} A list of nodes that represent the selected case's template.
 *
 * @template {string | number | symbol} Discriminant
 * @overload
 * @param {AsyncCell<Discriminant | null | undefined> | Cell<Discriminant | null | undefined> | Discriminant | null | undefined} value - A reactive `Cell` or a static value to determine the active case.
 * @param {Record<Discriminant, () => JSX.Template>} cases - An object mapping possible values to template-generating functions.
 * @returns {JSX.Template} A list of nodes that represent the selected case's template.
 */

/**
 * @param {*} value
 * @param {*} cases
 * @param {*} [defaultCase]
 */
export function Switch(value, cases, defaultCase) {
  return createSwitch(value, cases, defaultCase, null);
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
 * @param {AsyncCell<Obj | null | undefined> | Cell<Obj | null | undefined> | Obj | null | undefined} value - A reactive `Cell` or a static value to determine the active case.
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
 * @param {AsyncCell<Obj | null | undefined> | Cell<Obj | null | undefined> | Obj | null | undefined} value - A reactive `Cell` or a static value to determine the active case.
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
Switch.OnProperty = (value, key, cases, defaultCase) =>
  createSwitch(value, cases, defaultCase, key);
