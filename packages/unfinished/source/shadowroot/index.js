/** @import { JSX } from '../jsx-runtime/types.ts' */

import { getGlobalContext } from '../library/context.js';
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
 *
 * @note
 * When using static site generation, the shadow root _will not be rendered_ if
 * `mode` is set to "closed". This is because it becomes inaccessible in JavaScript
 * and can neither be serialized nor hydrated on the client. Use `closed` shadow-roots
 * only in client-side projects.
 */
export function ShadowRoot(props) {
  const { mode, children } = props;
  const { window } = getGlobalContext();

  const shadowRoot = /** @type {ShadowRootContainer} */ (
    window.document.createElement('div')
  );

  // @ts-ignore: The import.meta.env types are available in Vite.
  if (import.meta.env.SSR) {
    if (mode === 'closed') {
      const message =
        'Closed shadow roots cannot by hydrated on the client. This code will end up static in the browser.';
      console.trace(message);
    }
  }

  shadowRoot.__mode = mode ?? 'open';
  shadowRoot.__isShadowRootContainer = true;
  appendChild(shadowRoot, 'shadow-root', children);
  return shadowRoot;
}
