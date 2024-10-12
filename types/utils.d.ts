/**
 * Converts an object of styles to a CSS stylesheet string.
 *
 * @param {Partial<CSSStyleDeclaration>} styles - An object where the keys are CSS property names and the values are CSS property values.
 * @param {boolean} [useHost] - Whether to include the `:host` selector in the stylesheet.
 * @param {any} [element] The target element, if any.
 * @returns {string} A CSS stylesheet string that can be applied as a style to an HTML element.
 */
export function convertObjectToCssStylesheet(styles: Partial<CSSStyleDeclaration>, useHost?: boolean | undefined, element?: any): string;
/**
 * Converts a string to kebab-case.
 * @param {string} str - The input string to convert.
 * @returns {string} The input string converted to kebab-case.
 */
export function toKebabCase(str: string): string;
/**
 * Generates an array of DOM nodes from a given input.
 * @param {JSX.Template | TemplateStringsArray} children - The input to generate DOM nodes from.
 * @returns {Node[]}
 */
export function generateChildNodes(children: JSX.Template | TemplateStringsArray): Node[];
/**
 * Checks if the given value is not an object.
 *
 * @param {any} value - The value to check.
 * @returns {boolean} `true` if the value is not an object, `false` otherwise.
 */
export function isNotObject(value: any): boolean;
