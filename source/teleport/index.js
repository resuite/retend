import { Cell } from '@adbl/cells';
import { useObserver } from '../library/observer.js';
import { appendChild, setAttributeFromProps } from '../library/jsx.js';
import { generateChildNodes } from '../library/utils.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.js' */

/**
 * @typedef TeleportOnlyProps
 *
 * The parent element to teleport to, or a selector for the parent element.
 * @property {string | Element} to
 *
 * Data to be passed to the component.
 * @property {JSX.Template} [children]
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
  const teleportId = crypto.randomUUID();
  const observer = useObserver();
  const document = globalThis.window.document;
  const anchorNode = document.createComment('teleport-anchor');

  observer.onConnected(Cell.source(anchorNode), () => {
    const parent =
      target instanceof Element ? target : document.querySelector(target);
    if (!parent) {
      console.error(
        'Could not find teleport target for bottom drawer. ',
        target,
        'is not a matched selector in the DOM.'
      );
      return;
    }
    const staleInstance = parent.querySelector(
      `unfinished-teleport[data-teleport-id='${teleportId}']`
    );
    const newInstance = document.createElement('unfinished-teleport');
    newInstance.setAttribute('data-teleport-id', teleportId);

    for (const [key, value] of Object.entries(rest)) {
      if (key === 'children') continue;
      setAttributeFromProps(newInstance, key, value);
    }

    for (const child of generateChildNodes(props.children)) {
      appendChild(newInstance, newInstance.tagName.toLowerCase(), child);
    }

    if (staleInstance) staleInstance.replaceWith(newInstance);
    else parent.append(newInstance);

    return () => newInstance.remove();
  });

  return anchorNode;
}
