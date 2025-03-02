import { Cell } from '@adbl/cells';
import { useObserver } from '../library/observer.js';
import { appendChild, jsx, setAttributeFromProps } from '../library/jsx.js';
import { generateChildNodes } from '../library/utils.js';
import {
  getGlobalContext,
  isVNode,
  matchContext,
  Modes,
} from '../library/context.js';
import { useConsistent } from '../library/consistent.js';

let idCounter = 0;
const pendingTeleports = Cell.source(0);
pendingTeleports.listen((value) => {
  if (value !== 0) return;
  getGlobalContext().window.document.dispatchEvent(
    new Event('teleportscompleted')
  );
});

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
    const parent = findDomTarget(target, window.document);
    if (!parent) {
      console.error(
        'Could not find teleport target',
        target,
        ' is not a matched id or tagname in the DOM.'
      );
      return;
    }

    const key = `teleport/target/${idCounter++}`;
    const teleportId = await useConsistent(key, crypto.randomUUID);
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

    if (matchContext(window, Modes.VDom)) pendingTeleports.value--;

    return () => newInstance.remove();
  };

  if (matchContext(window, Modes.VDom)) {
    const anchorNode = window.document.createComment('teleport-anchor');
    pendingTeleports.value++;
    window.document.addEventListener(
      'teleportallowed',
      () => mountTeleportedNodes(anchorNode),
      {
        once: true,
      }
    );
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
 * Finds the target element for teleportation.
 * @param {string | Element | VDom.VElement} target
 * @param {Document | VDom.VDocument} document
 * @returns {Element | VDom.VElement | null | undefined}
 */
function findDomTarget(target, document) {
  if (typeof target !== 'string') {
    return target;
  }

  const isIdSelector = target.startsWith('#');

  if (isVNode(document)) {
    if (isIdSelector) {
      const id = target.slice(1);
      return document.findNode((node) => {
        if (node.nodeType !== 1) return false;
        const element = /** @type {VDom.VElement} */ (node);
        return element.getAttribute('id') === id;
      });
    }

    return document.findNode((node) => {
      if (node.nodeType !== 1) return false;
      const element = /** @type {VDom.VElement} */ (node);
      return element.tagName.toLowerCase() === target.toLowerCase();
    });
  }

  if (typeof target === 'string') {
    if (isIdSelector) {
      const id = target.slice(1);
      return document.getElementById(id);
    }

    return document.getElementsByTagName(target)[0];
  }

  return target;
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
