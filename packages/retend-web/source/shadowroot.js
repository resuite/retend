/** @import { JSX } from 'retend/jsx-runtime' */
import { ShadowRootFragment } from './dom-ops.js';

/**
 * @typedef ShadowRootProps
 *
 * @property {unknown} [children]
 * The children to render in the shadow root.
 */

/**
 * Provides an interface to append nodes to the shadow root of a parent component.
 *
 * @param {ShadowRootProps} props - The properties for the ShadowRoot component.
 * @returns {JSX.Template} A container with the children that will be rendered in the shadow root.
 *
 * @example
 * // Usage in JSX
 * <some-web-component>
 *   <ShadowRoot>
 *     <div>Content inside shadow DOM</div>
 *   </ShadowRoot>
 * </some-web-component>
 *
 * @note
 * The behavior of the element might seem counterintuitive when dealing with
 * multiple `ShadowRoot` components on the same parent. Ideally a parent node should
 * have at most one `ShadowRoot` child.
 */
export function ShadowRoot(props) {
  return new ShadowRootFragment(props);
}
