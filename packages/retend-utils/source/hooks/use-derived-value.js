import { Cell } from 'retend';

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
      return property.value;
    }
    return property;
  });
}
