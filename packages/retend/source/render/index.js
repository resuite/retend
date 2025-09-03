/** @import * as Context from '../context/index.js' */
/** @import { JSX } from '../jsx-runtime/types.ts' */
/** @import { ScopeSnapshot } from '../library/scope.js' */

const voidElements = new Set([
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'INPUT',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
]);

const SPLIT_TEXT_MARKER = '<!--@@-->';

/**
 * Escapes HTML special characters to prevent XSS and maintain correct rendering
 * @param {*} str
 * @returns {string}
 */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * @typedef {Object} RenderToStringOptions
 * @property {boolean} [markStaticNodes]
 * Whether to mark static elements with the [data-static] attribute.
 */

/**
 * Renders a JSX template to a string.
 *
 *
 * @param {JSX.Template} template - The JSX template to render.
 * @param {Context.WindowLike} window - The window object.
 * @param {RenderToStringOptions} [options] - Options for rendering the template.
 * @returns {Promise<string>} A promise that resolves to the rendered string.
 *
 * @description
 * This function takes a JSX template and converts it to its string representation.
 * It can handle various types of input, including primitive values, Promises,
 * DOM nodes, and arrays of templates.
 *
 * @example
 * const jsxTemplate = <div>Hello, world!</div>;
 * const renderedString = await renderToString(jsxTemplate);
 * console.log(renderedString); // Outputs: <div>Hello, world!</div>
 */
export async function renderToString(template, window, options = {}) {
  if (/string|number|boolean/.test(typeof template)) {
    return escapeHTML(template);
  }

  if (template instanceof Promise) {
    return await renderToString(await template, window, options);
  }

  if (template instanceof window.DocumentFragment) {
    let textContent = '';
    for (const child of template.childNodes) {
      textContent += await renderToString(child, window, options);
    }
    return textContent;
  }

  if (
    'MarkupContainerNode' in window &&
    template instanceof window.MarkupContainerNode
  ) {
    return template.html;
  }

  if (
    template instanceof window.Comment &&
    '__promise' in template &&
    template.__promise instanceof Promise
  ) {
    const value = await template.__promise;
    return await renderToString(value, window, options);
  }

  if (template instanceof window.Node) {
    /*
     * TODO: There is a bug in happy-dom where
     * template instanceof window.Text is always false,
     * even when the nodeType is Node.TEXT_NODE
     */
    if (template.nodeType === window.Node.TEXT_NODE) {
      return escapeHTML(template.textContent ?? '');
    }

    if (template.nodeType === window.Node.COMMENT_NODE) {
      return `<!--${escapeHTML(template.textContent ?? '')}-->`;
    }

    if (template instanceof window.ShadowRoot) {
      let text = `<template shadowrootmode="${template.mode}">`;

      if (options.markStaticNodes) {
        const isStatic = nodeIsStatic(/** @type {*} */ (template), window);
        if (isStatic) {
          Reflect.set(template, '__isStatic', true);
        }
      }

      for (const child of template.childNodes) {
        text += await renderToString(child, window, options);
      }
      text += '</template>';
      return text;
    }

    if (template instanceof window.Element) {
      const tagName = template.tagName.toLowerCase();

      let text = `<${tagName}`;

      for (const attribute of template.attributes) {
        text += ` ${attribute.name}="${escapeHTML(attribute.value)}"`;
      }

      if (options.markStaticNodes) {
        const isStatic = nodeIsStatic(/** @type {*} */ (template), window);
        if (isStatic) {
          Reflect.set(template, '__isStatic', true);
          const parentIsStatic =
            template.parentNode &&
            Reflect.get(template.parentNode, '__isStatic');

          if (!parentIsStatic) {
            text += ' data-static';
          }
        }
      }

      const isVoid = voidElements.has(template.tagName);
      if (!isVoid || template.childNodes.length > 0 || template.shadowRoot) {
        text += '>';

        if (template.shadowRoot) {
          text += await renderToString(template.shadowRoot, window, options);
        }

        let precededByTextNode = false;
        for (const child of template.childNodes) {
          // Insert marker between consecutive text nodes to preserve whitespace
          // This prevents text node merging during HTML parsing
          const shouldSplit =
            precededByTextNode &&
            child.nodeType === window.Node.TEXT_NODE &&
            (Boolean(child.textContent?.trim()) || '__attributeCells' in child);

          if (shouldSplit) {
            text += `${SPLIT_TEXT_MARKER}${await renderToString(
              child,
              window,
              options
            )}`;
          } else {
            text += await renderToString(child, window, options);
          }
          precededByTextNode =
            child.nodeType === window.Node.TEXT_NODE &&
            (Boolean(child.textContent?.trim()) || '__attributeCells' in child);
        }

        text += `</${tagName}>`;
      } else {
        text += '/>';
      }

      return text;
    }

    if (template instanceof window.Document) {
      return await renderToString(template.documentElement, window, options);
    }
  }

  if (Array.isArray(template)) {
    let textContent = '';
    for (const child of template) {
      textContent += await renderToString(child, window, options);
    }
    return textContent;
  }

  return '';
}

/**
 * Checks if a node has no reactivity attached so it can be marked as static.
 * Static node can be safely skipped during hydration.
 * @param {Context.NodeLike & {
 *  __isHydrationUpgradable?: boolean,
 *  __ref?: any,
 *  __attributeCells?: Map<string, any>,
 *  __isTeleportAnchor?: boolean;
 *  __eventListenerList?: Map<string, any>;
 *  __originScopeSnapshot?: ScopeSnapshot
 *  hiddenAttributes?: Map<string, any>,
 *  getAttribute: (name: string) => string | null,
 *  childNodes: any[],
 *  __commentRangeSymbol?: any
 * shadowRoot?: {
 *  mode: string,
 *  childNodes: any[]
 * }
 * }} node
 * @param {Context.WindowLike} window
 */
function nodeIsStatic(node, window) {
  if (node.__commentRangeSymbol) return false;
  if (node.__isTeleportAnchor) return false;
  if (node.__originScopeSnapshot) return false;
  if (node.__attributeCells?.size) return false;
  if (node.__eventListenerList?.size) return false;

  if (node.nodeType === window.Node.ELEMENT_NODE) {
    if (node.getAttribute('data-static') !== null) return true;
    if (node.__ref) return false;
    if (node.hiddenAttributes?.size) return false;

    for (const child of node.childNodes) {
      if (!nodeIsStatic(child, window)) return false;
    }
  }

  if (node.shadowRoot) {
    if (node.shadowRoot.mode === 'closed') return true; // might as well be static
    for (const child of node.shadowRoot.childNodes) {
      if (!nodeIsStatic(child, window)) return false;
    }
  }

  return true;
}
