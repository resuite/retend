// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

import { appendChild, setAttributeFromProps } from '../library/jsx.js';

/**
 * @typedef IncludeComponentProps
 *
 * @property {string} from
 * The selector of the component to include.
 */

/**
 * @typedef {Omit<JSX.IntrinsicElements['div'], 'align'> & IncludeComponentProps} IncludeProps
 */

/**
 * Includes a component from the DOM based on a selector.
 * @param {IncludeProps} props - The props for the Include component.
 * @returns {JSX.Template} The included component, or null if it could not be found.
 */
export function Include(props) {
  if (!globalThis.window) {
    return null;
  }
  if (!props.from) {
    console.error('Include component requires a "from" prop.');
    return null;
  }

  const component = /** @type {import('../library/jsx.js').JsxElement} */ (
    globalThis.window.document.querySelector(props.from)
  );
  if (!component) {
    console.error(
      `Include component could not find component with selector "${props.from}".`
    );
    return null;
  }

  const { from, children, ...rest } = props;

  if (children) {
    appendChild(component, component.tagName.toLowerCase(), children);
  }

  for (const [key, value] of Object.entries(rest)) {
    setAttributeFromProps(component, key, value);
  }

  return component;
}
