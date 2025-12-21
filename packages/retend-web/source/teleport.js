/** @import { JSX } from 'retend/jsx-runtime' */

import { getGlobalContext } from 'retend/context';
import {
  useConsistent,
  useObserver,
  getActiveRenderer,
  linkNodes,
  createNodesFromTemplate,
} from 'retend';
import { DOMRenderer } from './dom-renderer.js';

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
  const { to: target, ...rest } = props;
  const observer = useObserver();
  const { teleportIdCounter } = getGlobalContext();
  const renderer = /** @type {DOMRenderer} */ (getActiveRenderer());
  /** @type {string | undefined} */
  let teleportId;
  const key = `teleport/target/${teleportIdCounter.value++}`;

  /** @param {Node} anchorNode */
  const mountTeleportedNodes = async (anchorNode) => {
    if (!anchorNode.isConnected) return;

    const renderer = getActiveRenderer();
    const window = /** @type {Window} */ (renderer.host);
    const parent = window.document.querySelector(target);

    if (!parent) {
      const message = `Could not find teleport target, ${target} is not a matched id or tagname in the DOM.`;
      console.error(message);
      return;
    }

    teleportId = await useConsistent(key, () => crypto.randomUUID());
    const staleInstance = parent.querySelector(
      `retend-teleport[data-teleport-id='${teleportId}']`
    );
    const newInstance = window.document.createElement('retend-teleport');
    newInstance.setAttribute('data-teleport-id', teleportId);

    for (const [key, value] of Object.entries(rest)) {
      if (key === 'children') continue;
      renderer.setProperty(newInstance, key, value);
    }

    const children = createNodesFromTemplate(
      /** @type {*} */ (props.children),
      renderer
    );
    for (const child of children) {
      linkNodes(newInstance, child, renderer);
    }

    if (staleInstance)
      staleInstance.replaceWith(/** @type {*} */ (newInstance));
    else parent.append(/** @type {*} */ (newInstance));

    return () => newInstance.remove();
  };

  return renderer.scheduleTeleport(
    mountTeleportedNodes,
    observer,
    // @ts-expect-error
    target,
    teleportId
  );
}
