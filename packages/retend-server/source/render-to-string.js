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

const SPLIT_TEXT_MARKER = '<!--retend:text-separator-->';
const EMPTY_TEXT_MARKER = '<!--retend:empty-text-->';
const rawTextElements = new Set(['SCRIPT', 'STYLE']);

/**
 * Renders a JSX template to a string.
 *
 *
 * @param {JSX.Template} template - The JSX template to render.
 * @param {Window & globalThis | VDom.VWindow} window - The window object.
 * @returns {string} The rendered string.
 *
 * @description
 * This function takes a JSX template and converts it to its string representation.
 * It can handle various types of input, including primitive values,
 * DOM nodes, and arrays of templates.
 *
 * @example
 * const jsxTemplate = <div>Hello, world!</div>;
 * const renderedString = renderToString(jsxTemplate);
 * console.log(renderedString); // Outputs: <div>Hello, world!</div>
 */
export function renderToString(template, window, inRawTextElement = false) {
  if (/string|number|boolean/.test(typeof template)) {
    return inRawTextElement ? String(template) : escapeHTML(template);
  }

  if (
    'MarkupContainerNode' in window &&
    template instanceof window.MarkupContainerNode
  ) {
    return template.html;
  }

  if (template instanceof window.Node) {
    /*
     * TODO: There is a bug in happy-dom where
     * template instanceof window.Text is always false,
     * even when the nodeType is Node.TEXT_NODE
     */
    if (template.nodeType === window.Node.TEXT_NODE) {
      if (inRawTextElement) return template.textContent ?? '';
      if (template.textContent === '') return EMPTY_TEXT_MARKER;
      return escapeHTML(template.textContent ?? '');
    }

    if (template.nodeType === window.Node.COMMENT_NODE) {
      return `<!--${escapeHTML(template.textContent ?? '')}-->`;
    }

    if (template instanceof window.ShadowRoot) {
      return `<template shadowrootmode="open">${renderChildren(
        template.childNodes,
        window,
        false
      )}</template>`;
    }

    if (template instanceof window.DocumentFragment) {
      return renderChildren(template.childNodes, window, inRawTextElement);
    }

    if (template instanceof window.Element) {
      const tagName = template.tagName.toLowerCase();
      const isRawTextElement = rawTextElements.has(template.tagName);

      let text = `<${tagName}`;

      for (const attribute of template.attributes) {
        text += ` ${attribute.name}="${escapeHTML(attribute.value)}"`;
      }

      const isVoid = voidElements.has(template.tagName);
      if (!isVoid || template.childNodes.length > 0 || template.shadowRoot) {
        text += '>';

        if (template.shadowRoot) {
          text += renderToString(template.shadowRoot, window, false);
        }

        let precededByTextNode = false;
        for (const child of template.childNodes) {
          if (
            !isRawTextElement &&
            precededByTextNode &&
            child.nodeType === window.Node.TEXT_NODE
          ) {
            text += SPLIT_TEXT_MARKER;
          }
          text += renderToString(child, window, isRawTextElement);
          precededByTextNode = child.nodeType === window.Node.TEXT_NODE;
        }

        text += `</${tagName}>`;
      } else {
        text += '/>';
      }

      return text;
    }

    if (template instanceof window.Document) {
      return renderToString(template.documentElement, window, false);
    }
  }

  if (Array.isArray(template)) {
    return renderChildren(template, window, inRawTextElement);
  }

  return '';
}

/**
 * @param {Iterable<JSX.Template>} children
 * @param {Window & globalThis | VDom.VWindow} window
 * @param {boolean} inRawTextElement
 */
function renderChildren(children, window, inRawTextElement) {
  let text = '';
  for (const child of children) {
    text += renderToString(child, window, inRawTextElement);
  }
  return text;
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
