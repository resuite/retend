/** @import { JSX } from '../jsx-runtime/types.ts' */

import { Cell, AsyncCell } from '@adbl/cells';

import { createGroupFromNodes } from '../_internals.js';
import { useAwait } from './await.js';
import { getActiveRenderer } from './renderer.js';
import { branchState, withState } from './scope.js';

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
  return () => {
    const renderer = getActiveRenderer();

    for (const fn of Object.values(cases)) {
      if (typeof fn === 'function' && !fn.name) {
        Object.defineProperty(fn, 'name', { value: 'Switch.Case' });
      }
    }

    if (!Cell.isCell(value)) {
      if (value in cases && cases[value]) {
        const nodes = renderer.handleComponent(cases[value], []);
        return nodes;
      }

      if (defaultCase) {
        const nodes = renderer.handleComponent(defaultCase, [value]);
        return nodes;
      }

      return undefined;
    }

    const snapshot = branchState();
    if (value instanceof AsyncCell) useAwait()?.waitUntil(value);

    /** @param {any} value */
    const callback = (value) => {
      return withState(snapshot, () => {
        const caseCaller = cases[value];
        if (caseCaller) {
          const newNodes = renderer.handleComponent(
            caseCaller,
            [value],
            snapshot
          );
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }

        if (defaultCase) {
          const newNodes = renderer.handleComponent(
            defaultCase,
            [value],
            snapshot
          );
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }
        return [];
      });
    };

    /**
     * @param {*} nextValue
     */
    const processValueChange = (nextValue) => {
      snapshot.node.dispose();
      const results = callback(nextValue);
      renderer.write(handle, results);
      renderer.observer?.flush();
      snapshot.node.activate();
    };

    // It is important that the listener is registered first.
    value.listen((nextValue) => {
      if (nextValue instanceof Promise) nextValue.then(processValueChange);
      else processValueChange(nextValue);
    });

    const initialValue = value.get();
    /** @type {ReturnType<typeof renderer.createGroupHandle>} */
    let handle;
    /** @type {ReturnType<typeof renderer.createGroup>} */
    let group;

    if (initialValue instanceof Promise) {
      group = renderer.createGroup();
      handle = renderer.createGroupHandle(group);
      initialValue.then((resolved) => processValueChange(resolved));
      return group;
    }

    const initialResults = callback(initialValue);
    group = createGroupFromNodes(initialResults, renderer);
    handle = renderer.createGroupHandle(group);
    return group;
  };
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
Switch.OnProperty = (value, key, cases, defaultCase) => {
  return () => {
    const renderer = getActiveRenderer();

    for (const fn of Object.values(cases)) {
      if (typeof fn === 'function' && !fn.name) {
        Object.defineProperty(fn, 'name', { value: 'Switch.Case' });
      }
    }

    if (!Cell.isCell(value)) {
      const discriminant = value[key];

      if (discriminant in cases && cases[discriminant]) {
        const nodes = renderer.handleComponent(cases[discriminant], [value]);
        return nodes;
      }

      if (defaultCase) {
        const nodes = renderer.handleComponent(defaultCase, [value]);
        return nodes;
      }

      return undefined;
    }

    const snapshot = branchState();
    if (value instanceof AsyncCell) useAwait()?.waitUntil(value);

    /** @param {any} cellValue */
    const callback = (cellValue) => {
      return withState(snapshot, () => {
        const discriminant = cellValue[key];

        const caseCaller = cases[discriminant];
        if (caseCaller) {
          const newNodes = renderer.handleComponent(
            caseCaller,
            [cellValue],
            snapshot
          );
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }

        if (defaultCase) {
          const newNodes = renderer.handleComponent(
            defaultCase,
            [cellValue],
            snapshot
          );
          return Array.isArray(newNodes) ? newNodes : [newNodes];
        }

        return [];
      });
    };

    /**
     * @param {*} nextValue
     */
    const processValueChange = (nextValue) => {
      snapshot.node.dispose();
      const results = callback(nextValue);
      renderer.write(handle, results);
      renderer.observer?.flush();
      snapshot.node.activate();
    };

    // It is important that the listener is registered first.
    value.listen((nextValue) => {
      if (nextValue instanceof Promise) nextValue.then(processValueChange);
      else processValueChange(nextValue);
    });

    const initialValue = value.get();
    /** @type {ReturnType<typeof renderer.createGroupHandle>} */
    let handle;
    /** @type {ReturnType<typeof renderer.createGroup>} */
    let group;

    if (initialValue instanceof Promise) {
      group = renderer.createGroup();
      handle = renderer.createGroupHandle(group);
      initialValue.then((resolved) => processValueChange(resolved));
      return group;
    }

    const initialResults = callback(initialValue);
    group = createGroupFromNodes(initialResults, renderer);
    handle = renderer.createGroupHandle(group);
    return group;
  };
};
