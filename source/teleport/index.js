import { Cell } from '@adbl/cells';
import { useObserver } from '../library/observer.js';
import { appendChild, setAttributeFromProps } from '../library/jsx.js';
import { generateChildNodes } from '../library/utils.js';
import {
  getGlobalContext,
  isVNode,
  matchContext,
  Modes,
} from '../library/context.js';
import { useConsistent } from '../library/consistent.js';

let idCounter = 0;

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.js' */
// @ts-ignore: Deno has issues with @import tags.
/** @import * as VDom from '../v-dom/index.js' */
// @ts-ignore: Deno has issues with @import tags.
/** @import { NodeLike } from '../library/context.js' */

/**
 * @typedef TeleportOnlyProps
 *
 * @property {string | Element | VDom.VElement} to
 * The parent element to teleport to, or a string for matching the target element.
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
  const { window } = getGlobalContext();

  /** @param {NodeLike} anchorNode */
  const mountTeleportedNodes = async (anchorNode) => {
    if (!anchorNode.isConnected) return;

    const { window } = getGlobalContext();
    const parent =
      typeof target !== 'string'
        ? target
        : window.document.querySelector(target);

    if (!parent) {
      console.error(
        'Could not find teleport target',
        target,
        ' is not a matched id or tagname in the DOM.'
      );
      return;
    }

    const key = `teleport/target/${idCounter++}`;
    const teleportId = await useConsistent(key, () => crypto.randomUUID());
    const staleInstance = findStaleTeleport(parent, teleportId);
    const newInstance = window.document.createElement('unfinished-teleport');
    newInstance.setAttribute('data-teleport-id', teleportId);

    for (const [key, value] of Object.entries(rest)) {
      if (key === 'children') continue;
      setAttributeFromProps(newInstance, key, value);
    }

    for (const child of generateChildNodes(
      /** @type {JSX.Template} */ (props.children)
    )) {
      appendChild(newInstance, newInstance.tagName.toLowerCase(), child);
    }

    if (staleInstance)
      staleInstance.replaceWith(/** @type {*} */ (newInstance));
    else parent.append(/** @type {*} */ (newInstance));

    return () => newInstance.remove();
  };

  if (matchContext(window, Modes.VDom)) {
    const anchorNode = window.document.createComment('teleport-anchor');
    window.document.teleportMounts.push(() => mountTeleportedNodes(anchorNode));
    return anchorNode;
  }

  const anchorNode = window.document.createComment('teleport-anchor');
  Reflect.set(anchorNode, '__isTeleportAnchor', true);
  observer.onConnected(Cell.source(anchorNode), () =>
    mountTeleportedNodes(anchorNode)
  );

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
      `unfinished-teleport[data-teleport-id='${teleportId}']`
    );
  }

  return parent.findNode((node) => {
    if (node.nodeType !== 1) return false;
    const element = /** @type {VDom.VElement} */ (node);
    return (
      element.tagName === 'UNFINISHED-TELEPORT' &&
      element.getAttribute('data-teleport-id') === teleportId
    );
  });
}
