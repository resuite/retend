/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import * as VDom from '../v-dom/index.js' */
/** @import { NodeLike } from '../context/index.js' */

import { Cell } from '@adbl/cells';
import { useObserver } from '../library/observer.js';
import { appendChild, setAttributeFromProps } from '../library/jsx.js';
import { generateChildNodes } from '../library/utils.js';
import {
  getGlobalContext,
  isVNode,
  matchContext,
  Modes,
} from '../context/index.js';
import { useConsistent } from '../library/consistent.js';

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
  const { window, teleportIdCounter } = getGlobalContext();
  /** @type {string | undefined} */
  let teleportId;
  const key = `teleport/target/${teleportIdCounter.value++}`;

  /** @param {NodeLike} anchorNode */
  const mountTeleportedNodes = async (anchorNode) => {
    if (!anchorNode.isConnected) return;

    const { window } = getGlobalContext();
    const parent = window.document.querySelector(target);

    if (!parent) {
      const message = `Could not find teleport target, ${target} is not a matched id or tagname in the DOM.`;
      console.error(message);
      return;
    }

    teleportId = await useConsistent(key, () => crypto.randomUUID());
    const staleInstance = findStaleTeleport(parent, teleportId);
    const newInstance = window.document.createElement('retent-teleport');
    newInstance.setAttribute('data-teleport-id', teleportId);

    for (const [key, value] of Object.entries(rest)) {
      if (key === 'children') continue;
      setAttributeFromProps(newInstance, key, value);
    }

    const children = generateChildNodes(/** @type {*} */ (props.children));
    for (const child of children) {
      appendChild(newInstance, newInstance.tagName.toLowerCase(), child);
    }

    if (staleInstance)
      staleInstance.replaceWith(/** @type {*} */ (newInstance));
    else parent.append(/** @type {*} */ (newInstance));

    return () => newInstance.remove();
  };

  if (matchContext(window, Modes.Interactive)) {
    const anchorNode = window.document.createComment('teleport-anchor');
    const ref = Cell.source(anchorNode);
    observer.onConnected(ref, () => mountTeleportedNodes(anchorNode));

    return anchorNode;
  }

  // VDom mode:
  const anchorNode = window.document.createComment('teleport-anchor');
  window.document.teleportMounts.push(() => mountTeleportedNodes(anchorNode));
  //@ts-expect-error: Observers are not supported in VDom, they work only in Interactive mode,
  // but a callback still needs to be registered so the teleport can be unmounted as soon
  // as the anchor node is disconnected.
  const ref = /** @type {Cell<Node>} */ (Cell.source(anchorNode));
  Reflect.set(anchorNode, '__isTeleportAnchor', true);
  Reflect.set(anchorNode, '__ref', ref);
  observer.onConnected(ref, () => {
    return () => {
      const { window } = getGlobalContext();
      const parent = window.document.querySelector(target);
      if (!parent) {
        const message = `Could not find teleport target, ${target} is not a matched id or tagname in the DOM.`;
        console.error(message);
        return;
      }
      if (!teleportId) return;
      const instance = findStaleTeleport(parent, teleportId);
      if (instance) instance.remove();
    };
  });
  return anchorNode;
}

/**
 * Finds the last rendered teleport instance with a matching teleportId.
 * @param {Element | VDom.VElement} parent
 * @param {string} teleportId
 * @returns {Element | VDom.VElement | null | undefined}
 */
function findStaleTeleport(parent, teleportId) {
  if (!isVNode(parent)) {
    return parent.querySelector(
      `retent-teleport[data-teleport-id='${teleportId}']`
    );
  }

  return parent.findNode((node) => {
    if (node === parent) return false;
    if (node.nodeType !== 1) return false;
    const element = /** @type {VDom.VElement} */ (node);
    return (
      element.tagName === 'retent-TELEPORT' &&
      element.getAttribute('data-teleport-id') === teleportId
    );
  });
}
