/** @import { JSX } from 'retend/jsx-runtime' */
/** @import * as VDom from './v-dom/index.js' */

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
 * Renders a JSX template to a string.
 *
 *
 * @param {JSX.Template} template - The JSX template to render.
 * @param {Window & globalThis | VDom.VWindow} window - The window object.
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
export async function renderToString(template, window) {
  if (/string|number|boolean/.test(typeof template)) {
    return escapeHTML(template);
  }

  if (template instanceof Promise) {
    return await renderToString(await template, window);
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
    return await renderToString(value, window);
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
      let text = '<template shadowrootmode="open">';
      for (const child of template.childNodes) {
        text += await renderToString(child, window);
      }
      text += '</template>';
      return text;
    }

    if (template instanceof window.DocumentFragment) {
      let textContent = '';
      for (const child of template.childNodes) {
        textContent += await renderToString(child, window);
      }
      return textContent;
    }

    if (template instanceof window.Element) {
      const tagName = template.tagName.toLowerCase();

      let text = `<${tagName}`;

      for (const attribute of template.attributes) {
        text += ` ${attribute.name}="${escapeHTML(attribute.value)}"`;
      }

      const isVoid = voidElements.has(template.tagName);
      if (!isVoid || template.childNodes.length > 0 || template.shadowRoot) {
        text += '>';

        if (template.shadowRoot) {
          text += await renderToString(template.shadowRoot, window);
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
            text += `${SPLIT_TEXT_MARKER}${await renderToString(child, window)}`;
          } else {
            text += await renderToString(child, window);
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
      return await renderToString(template.documentElement, window);
    }
  }

  if (Array.isArray(template)) {
    let textContent = '';
    for (const child of template) {
      textContent += await renderToString(child, window);
    }
    return textContent;
  }

  return '';
}

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
