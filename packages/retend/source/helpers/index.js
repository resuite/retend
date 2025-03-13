import { getGlobalContext, matchContext, Modes } from '../context/index.js';
import { setAttributeFromProps } from '../library/jsx.js';

/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { MarkupContainerNode } from '../v-dom/index.js' */

/**
 * @typedef InlineSvgProps
 * @property {string} href Address of the svg icon to inline.
 */

/**
 * @typedef {InlineSvgProps & JSX.IntrinsicElements['svg']} SvgProps
 */

/** @type {RequestInit} */
const svgFetchOptions = { cache: 'force-cache' };
const svgMap = new Map();

/**
 * Asynchronously fetches and inlines an SVG icon using its URL.
 *
 * @clientOnly
 * @param {SvgProps} props
 * @returns {Promise<JSX.Template>} The SVG element created, or an empty template if the request fails.
 */
export async function InlineSvg(props) {
  const { window } = getGlobalContext();

  try {
    let svg = svgMap.get(props.href);
    if (!svg) {
      const response = await fetch(props.href, svgFetchOptions);
      svg = await response.text();
      svgMap.set(props.href, svg);
    }

    /** @type {Element | null | MarkupContainerNode} */
    let element;
    if (matchContext(window, Modes.Interactive)) {
      const range = window.document.createRange();
      element = range.createContextualFragment(svg).querySelector('svg');
    } else {
      element = window.document.createMarkupNode(svg);
    }

    if (element) {
      Reflect.set(element, '__attributeCells', new Set());
      Reflect.set(element, '__eventListenerList', new Map());
      for (const [attribute, value] of Object.entries(props)) {
        if (attribute === 'href') continue;
        setAttributeFromProps(/** @type {any} */ (element), attribute, value);
      }
    }
    return element ?? window.document.createElement('template');
  } catch (error) {
    console.error('Error fetching SVG:', error);
    return window.document.createElement('template');
  }
}
