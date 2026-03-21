/** @import { JSX } from 'retend/jsx-runtime' */

import { Cell, If, onSetup } from 'retend';

export { serverResource } from './server-data.js';

/**
 * @typedef {Object} ClientOnlyProps
 * @property {JSX.Template} children
 * The content to render only on the client side.
 * @property {JSX.Template} [fallback]
 * Optional content to render during server-side rendering
 * and before the client has mounted.
 */

/**
 * A component that only renders its children on the client side.
 *
 * During server-side rendering, the `fallback` is rendered instead
 * (or nothing if no fallback is provided). Once the component is
 * mounted on the client, it swaps to the real `children`.
 *
 * This is useful for components that depend on browser-only APIs
 * (e.g., `window.innerWidth`) and would produce a server/client
 * mismatch during hydration.
 *
 * @param {ClientOnlyProps} props
 * @returns {JSX.Template}
 *
 * @example
 * ```tsx
 * import { ClientOnly } from 'retend-server';
 *
 * const Page = () => (
 *   <ClientOnly fallback={<p>Loading...</p>}>
 *     <WindowSizeDependentComponent />
 *   </ClientOnly>
 * );
 * ```
 */
export function ClientOnly(props) {
  const { children, fallback } = props;
  const mounted = Cell.source(false);

  onSetup(() => {
    mounted.set(true);
  });

  return If(mounted, {
    true: () => children,
    false: () => fallback,
  });
}
