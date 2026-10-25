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
/*
 * Elements whose children are one text run. They cannot hold comments, so
 * structural markers must never be emitted inside them.
 */
const rcdataElements = new Set(['TEXTAREA', 'TITLE']);
/** @typedef {'raw' | 'text'} TextMode */

/**
 * Renders a JSX template to a string.
 *
 *
 * @param {JSX.Template} template - The JSX template to render.
 * @param {Window & globalThis | VDom.VWindow} window - The window object.
 * @param {TextMode} [mode] - The text mode inherited from the enclosing element.
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
export function renderToString(template, window, mode) {
  if (/string|number|boolean/.test(typeof template)) {
    return mode === 'raw' ? String(template) : escapeHTML(template);
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
      const content = template.textContent ?? '';
      if (content === '') return mode ? '' : EMPTY_TEXT_MARKER;
      return mode === 'raw' ? content : escapeHTML(content);
    }

    if (template.nodeType === window.Node.COMMENT_NODE) {
      return `<!--${escapeHTML(template.textContent ?? '')}-->`;
    }

    if (template instanceof window.ShadowRoot) {
      return `<template shadowrootmode="open">${renderChildren(
        template.childNodes,
        window
      )}</template>`;
    }

    if (template instanceof window.DocumentFragment) {
      return renderChildren(template.childNodes, window, mode);
    }

    if (template instanceof window.Element) {
      const tagName = template.tagName.toLowerCase();
      const childMode = rawTextElements.has(template.tagName)
        ? 'raw'
        : rcdataElements.has(template.tagName)
          ? 'text'
          : undefined;

      let text = `<${tagName}`;

      for (const attribute of template.attributes) {
        text += ` ${attribute.name}="${escapeHTML(attribute.value)}"`;
      }

      const isVoid = voidElements.has(template.tagName);
      if (!isVoid || template.childNodes.length > 0 || template.shadowRoot) {
        text += '>';

        if (template.shadowRoot) {
          text += renderToString(template.shadowRoot, window);
        }

        text += renderChildren(template.childNodes, window, childMode);

        text += `</${tagName}>`;
      } else {
        text += '/>';
      }

      return text;
    }

    if (template instanceof window.Document) {
      return renderToString(template.documentElement, window);
    }
  }

  if (Array.isArray(template)) {
    return renderChildren(template, window, mode);
  }

  return '';
}

/**
 * @param {Iterable<JSX.Template>} children
 * @param {Window & globalThis | VDom.VWindow} window
 * @param {TextMode} [mode]
 */
function renderChildren(children, window, mode) {
  let text = '';
  let previousWasText = false;
  /*
   * The parser merges adjacent text nodes, so text siblings need a separator.
   * Text-only elements cannot hold comments, so their children are serialized
   * as one merged text run instead.
   */
  for (const child of flattenChildren(children, window)) {
    const nodeType = /** @type {any} */ (child)?.nodeType;
    const isText = nodeType === window.Node.TEXT_NODE;
    if (!mode && previousWasText && isText) text += SPLIT_TEXT_MARKER;
    text += renderToString(child, window, mode);
    previousWasText = isText;
  }
  return text;
}

/**
 * Fragments and arrays contribute their children to the surrounding element, so
 * flattening them keeps sibling text runs next to each other.
 *
 * @param {Iterable<JSX.Template>} children
 * @param {Window & globalThis | VDom.VWindow} window
 * @returns {JSX.Template[]}
 */
function flattenChildren(children, window) {
  /** @type {JSX.Template[]} */
  const flat = [];
  for (const child of children) {
    if (Array.isArray(child)) flat.push(...flattenChildren(child, window));
    else if (
      /** @type {any} */ (child)?.nodeType ===
      window.Node.DOCUMENT_FRAGMENT_NODE
    ) {
      const fragment = /** @type {any} */ (child);
      flat.push(...flattenChildren(fragment.childNodes, window));
    } else flat.push(child);
  }
  return flat;
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
