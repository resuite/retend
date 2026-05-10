/** @import { JSX } from 'retend/jsx-runtime' */

import { Await, Cell, If, onSetup } from 'retend';

/**
 * @typedef {Object} ClientOnlyProps
 * @property {JSX.Children} children
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

/**
 * @typedef {Object} ClientReadyProps
 * @property {JSX.Children} children
 * The content to render after the app is running on the client and its
 * initial async work has completed.
 * @property {JSX.Template} [fallback]
 * Optional content to render during server-side rendering, hydration,
 * and the client subtree's initial async work.
 */

/**
 * A component that renders fallback content until a client-only subtree is
 * mounted and its initial `Await` boundary has finished resolving.
 *
 * Unlike `ClientOnly`, this keeps the fallback visible while async cells inside
 * the client subtree are still pending on the first client render.
 *
 * @param {ClientReadyProps} props
 * @returns {JSX.Template}
 *
 * @example
 * ```tsx
 * import { ClientReady } from 'retend-server';
 *
 * const App = () => (
 *   <ClientReady fallback={<p>Starting...</p>}>
 *     <Dashboard />
 *   </ClientReady>
 * );
 * ```
 */
export function ClientReady(props) {
  const { children, fallback } = props;
  const ready = Cell.source(false);

  const ClientReadyContent = () => {
    onSetup(() => ready.set(true));
    return children;
  };

  return [
    ClientOnly({
      children: () =>
        Await({
          children: ClientReadyContent,
        }),
    }),
    If(ready, {
      false: () => fallback,
    }),
  ];
}
