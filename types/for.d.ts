/**
 * Creates a dynamic mapping of an iterable to DOM nodes, efficiently updating when the iterable changes.
 *
 * @template {Iterable<any>} U
 * @param {Cell<U> | U} list - The iterable or Cell containing an iterable to map over
 * @param {(item: U extends Iterable<infer V> ? V : never, index: Cell<number>, iter: U) => JSX.Template} fn - Function to create a Template for each item
 * @returns {JSX.Template} - A Template representing the mapped items
 *
 * @example
 * // Create a reactive list of names
 * const names = Cell.source(['Alice', 'Bob', 'Charlie']);
 *
 * // Use For to create a dynamic list of <li> elements
 * const listItems = For(names, (name, index) => {
 *   const li = document.createElement('li');
 *   li.textContent = `${index.value + 1}. ${name}`;
 *   return li;
 * });
 *
 * // Append the list items to a <ul> element
 * const ul = document.createElement('ul');
 * ul.append(...listItems);
 * document.body.appendChild(ul);
 *
 * // Later, update the names
 * names.value.push('David');
 * // The list will automatically update to include the new name
 */
export function For<U extends Iterable<any>>(list: Cell<U> | U, fn: (item: U extends Iterable<infer V> ? V : never, index: Cell<number>, iter: U) => JSX.Template): JSX.Template;
import { Cell } from '@adbl/cells';
