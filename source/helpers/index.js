import { setAttributeFromProps, appendChild } from '../library/jsx.js';

/**
 * @typedef InlineSvgProps
 * @property {string} href address of the svg icon to inline.
 */

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * @typedef {InlineSvgProps & JSX.IntrinsicElements['svg']} SvgProps
 */

/** @type {RequestInit} */
const svgFetchOptions = {
  cache: 'force-cache',
};

const svgMap = new Map();

/**
 * Asynchronously fetches and inlines an SVG icon using its URL.
 * @param {SvgProps} props
 * @returns {Promise<Element>} The SVG element created, or an empty template if the request fails.
 */
export async function InlineSvg(props) {
  try {
    let svg = svgMap.get(props.href);
    if (!svg) {
      const response = await fetch(props.href, svgFetchOptions);
      svg = await response.text();
      svgMap.set(props.href, svg);
    }
    const range = globalThis.window.document.createRange();
    const element = range.createContextualFragment(svg).querySelector('svg');

    if (element) {
      Reflect.set(element, '__attributeCells', new Set());
      Reflect.set(element, '__eventListenerList', new Map());
      for (const [attribute, value] of Object.entries(props)) {
        if (attribute === 'href') continue;
        setAttributeFromProps(/** @type {any} */ (element), attribute, value);
      }
    }
    return element ?? globalThis.window.document.createElement('template');
  } catch (error) {
    console.error('Error fetching SVG:', error);
    return globalThis.window.document.createElement('template');
  }
}

/**
 * @typedef IncludeComponentProps
 *
 * @property {string} from
 * The selector of the component to include.
 */

/**
 * @typedef {Omit<JSX.IntrinsicElements['div'], 'align'> & IncludeComponentProps} IncludeProps
 */

/**
 * Includes a component from the DOM based on a selector.
 * @param {IncludeProps} props - The props for the Include component.
 * @returns {JSX.Template} The included component, or null if it could not be found.
 */
export function Include(props) {
  if (!globalThis.window) {
    return null;
  }
  if (!props.from) {
    console.error('Include component requires a "from" prop.');
    return null;
  }

  const component = /** @type {import('../library/jsx.js').JsxElement} */ (
    globalThis.window.document.querySelector(props.from)
  );
  if (!component) {
    console.error(
      `Include component could not find component with selector "${props.from}".`
    );
    return null;
  }

  const { from, children, ...rest } = props;

  if (children) {
    appendChild(component, component.tagName.toLowerCase(), children);
  }

  for (const [key, value] of Object.entries(rest)) {
    setAttributeFromProps(component, key, value);
  }

  return component;
}
