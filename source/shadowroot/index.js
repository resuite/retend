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

/**
 * @typedef ShadowRootContainerData
 *
 * @property {ShadowRootMode} [__mode]
 * @property {boolean} [__isShadowRootContainer]
 */

/** @typedef {ShadowRootContainerData & HTMLDivElement} ShadowRootContainer */

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
 * @example
 * // Creating a closed shadow root
 * <some-web-component>
 *   <ShadowRoot mode="closed">
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
  const { mode, children } = props;
  const shadowRoot = /** @type {ShadowRootContainer} */ (
    globalThis.window.document.createElement('div')
  );

  shadowRoot.__mode = mode ?? 'open';
  shadowRoot.__isShadowRootContainer = true;
  appendChild(shadowRoot, 'shadow-root', children);
  return shadowRoot;
}
