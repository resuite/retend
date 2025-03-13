/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { Cell } from '@adbl/cells' */
/** @import * as VDom from '../v-dom/index.js' */

import { getGlobalContext } from '../context/index.js';
import { appendChild, setAttributeFromProps } from '../library/jsx.js';

/**
 * @typedef IncludeComponentProps
 *
 * @property {string | Cell<Element | VDom.VElement | null>} from
 * The selector or Cell reference of the component to include.
 */

/**
 * @typedef {Omit<JSX.IntrinsicElements['div'], 'align'> & IncludeComponentProps} IncludeProps
 */

/**
 * Includes a component from the DOM based on a selector.
 *
 * @clientOnly
 * @param {IncludeProps} props - The props for the Include component.
 * @returns {JSX.Template} The included component, or null if it could not be found.
 */
export function Include(props) {
  const { window } = getGlobalContext();
  const { from, children, ...rest } = props;

  if (!from) {
    console.error('Include component requires a "from" prop.');
    return null;
  }

  const component =
    typeof from === 'string' ? window.document.querySelector(from) : from.value;

  console.log('Found include', component);

  if (!component) {
    if (typeof from === 'string') {
      console.error(
        `Include component could not find component with selector "${from}".`
      );
    } else {
      console.error(
        `Include component could not find component with Cell reference.`
      );
    }
    return null;
  }

  component.remove();

  if (children) {
    appendChild(component, component.tagName.toLowerCase(), children);
  }

  for (const [key, value] of Object.entries(rest)) {
    setAttributeFromProps(component, key, value);
  }

  return component;
}
