// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

import { appendChild } from '../library/jsx.js';

/**
 * @typedef ShadowRootProps
 *
 * @property {ShadowRootMode} [mode]
 * The mode to use for the shadow root. If not provided, the default mode is "open".
 *
 * @property {unknown} [children]
 * The children to render in the shadow root.
 */

class ShadowRootContainer extends DocumentFragment {
  /** @param {ShadowRootMode} mode  */
  constructor(mode) {
    super();
    this.__mode = mode;
  }

  get isShadowRootContainer() {
    return true;
  }
}

/**
 * Provides an interface to append nodes to the shadow root of a parent component.
 *
 * @param {ShadowRootProps} props - The properties for the ShadowRoot component.
 * @returns {JSX.Template} A container with the children that will be rendered in the shadow root.
 *
 * @example
 * // Usage in JSX
 * <some-component>
 *   <ShadowRoot>
 *     <div>Content inside shadow DOM</div>
 *   </ShadowRoot>
 * </some-component>
 *
 * @example
 * // Creating a closed shadow root
 * <some-component>
 *   <ShadowRoot mode="closed">
 *     <div>Content inside shadow DOM</div>
 *   </ShadowRoot>
 * </some-component>
 */
export function ShadowRoot(props) {
  const { mode, children } = props;
  const shadowRoot = new ShadowRootContainer(mode ?? 'open');
  appendChild(shadowRoot, 'shadow-root', children);
  return shadowRoot;
}
