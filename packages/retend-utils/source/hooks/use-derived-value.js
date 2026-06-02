import { AsyncCell, Cell } from 'retend';
/** @import { AsyncDerivedCell } from 'retend'; */

/**
 * Creates a derived cell from either a static value or another cell.
 * The returned cell will automatically update when the input cell changes,
 * or remain constant if the input is a static value.
 *
 * @template T
 * @param {Cell<T> | T} property - The input value or cell to derive from
 * @returns {Cell<T>} A derived cell that reflects the current value of the input
 *
 * @example
 * const { valueOrCell } = props;
 * const derivedValue = useDerivedValue(valueOrCell);
 */
export function useDerivedValue(property) {
  return Cell.derived(() => {
    if (property instanceof Cell) {
      return property.get();
    }
    return property;
  });
}

/**
 * Creates an async derived cell from a static value, a synchronous cell,
 * or an async cell. The returned cell resolves async cells, tracks
 * synchronous cells, or remains constant for static values.
 *
 * @template T
 * @param {AsyncCell<T> | Cell<T> | T} property - The input value or cell to derive from
 * @returns {AsyncDerivedCell<T>} An async derived cell that reflects the current value of the input
 *
 * @example
 * const { valueOrCell } = props;
 * const derivedValue = useDerivedAsyncValue(valueOrCell);
 */
export function useDerivedAsyncValue(property) {
  return Cell.derivedAsync(async (get) => {
    if (property instanceof Cell) {
      if (property instanceof AsyncCell) {
        return await get(property);
      }
      return get(property);
    }
    return property;
  });
}
