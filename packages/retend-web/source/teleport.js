/** @import { JSX } from 'retend/jsx-runtime' */

import {
  getActiveRenderer,
  linkNodes,
  createNodesFromTemplate,
  onSetup,
} from 'retend';
import { getGlobalContext } from 'retend/context';
/** @import { DOMRenderer } from './dom-renderer.js' */

/**
 * @typedef TeleportOnlyProps
 *
 * @property {string} to
 * The tag name, or an id prefixed with `#`, of the element to teleport to.
 * ## Note about selector matching.
 *
 * Teleportation only works with two types of CSS selectors:
 * - `#id` for matching an element by its ID.
 * - `tag` for matching an element by its tag name.
 *
 * Other selectors, such as `.class` or `[attribute=value]`, will lead to an unmatched
 * target.
 *
 * @property {JSX.Children} [children]
 * Data to be passed to the component.
 */

/**
 * @typedef {Omit<JSX.IntrinsicElements['div'], 'children'> & TeleportOnlyProps} TeleportProps
 */

/**
 * Teleports a component to a specified target in the DOM.
 *
 * @param {TeleportProps} props - The properties for the teleport component.
 * @returns {JSX.Template} A node that acts as an anchor for teleportation.
 *
 * @remarks
 * This function moves a component to a different location in the DOM specified by the `to` property.
 * If the target element is not found, an error is logged to the console.
 *
 * @example
 * ```tsx
 * <Teleport to="#target-element">
 *   <div>Content to teleport</div>
 * </Teleport>
 * ```
 */
export function Teleport(props) {
  const { to: target, children, ...rest } = props;
  const { globalData } = getGlobalContext();

  const teleportCounter = globalData.get('teleportCounter') ?? { value: 0 };
  globalData.set('teleportCounter', teleportCounter);

  const renderer = /** @type {DOMRenderer} */ (getActiveRenderer());
  const generatedTeleportId = `teleport/target/${teleportCounter.value++}`;
  let disposed = false;
  let mountedCleanup = () => {};

  const dispose = () => {
    disposed = true;
    mountedCleanup();
  };

  onSetup(() => dispose);

  /**
   * @param {Node} [anchor]
   * @param {boolean} [canDefer]
   */
  const mountTeleportedNodes = (anchor, canDefer) => {
    const source = /** @type {Node} */ (anchor);
    const teleportId = (source.textContent ?? '').slice(
      'retend:teleport:'.length
    );
    const wasCanceled = disposed || !source.isConnected;

    const parent = renderer.host.document.querySelector(target);
    if (!parent) {
      if (!wasCanceled && !canDefer) {
        console.error(
          `Could not find teleport target, ${target} is not a matched id or tagname in the DOM.`
        );
      }
      return wasCanceled ? null : false;
    }

    if (wasCanceled) {
      Array.from(parent.querySelectorAll('retend-teleport'))
        .find(
          (candidate) =>
            candidate.getAttribute('data-teleport-id') === teleportId
        )
        ?.remove();
      return null;
    }

    const hydratedContainer = renderer.claimHydrationTeleportContainer?.(
      parent,
      teleportId
    );
    const newInstance =
      hydratedContainer ?? renderer.createContainer('retend-teleport', props);
    renderer.setProperty(newInstance, 'data-teleport-id', teleportId);

    for (const [key, value] of Object.entries(rest)) {
      renderer.setProperty(newInstance, key, value);
    }
    Reflect.set(source, '__retendTeleportedContainer', newInstance);

    const nodes = createNodesFromTemplate(children, renderer);
    for (const child of nodes) {
      linkNodes(newInstance, child, renderer);
    }

    if (!hydratedContainer) renderer.append(parent, newInstance);
    queueMicrotask(() => renderer.observer?.flush());

    mountedCleanup = () => {
      Reflect.deleteProperty(source, '__retendTeleportedContainer');
      newInstance.remove();
    };

    if (disposed) {
      mountedCleanup();
      return null;
    }

    return dispose;
  };

  return renderer.scheduleTeleport(mountTeleportedNodes, generatedTeleportId);
}
