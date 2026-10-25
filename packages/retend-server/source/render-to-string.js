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
 * Elements whose children are a single text run. HTML comments are not parsed as
 * comments inside them, so structural markers must never be emitted there.
 */
const textOnlyElements = new Set([...rawTextElements, 'TEXTAREA', 'TITLE']);

/**
 * Renders a JSX template to a string.
 *
 *
 * @param {JSX.Template} template - The JSX template to render.
 * @param {Window & globalThis | VDom.VWindow} window - The window object.
 * @param {boolean} [inRawTextElement] - Whether the template sits inside a `<script>` or `<style>`.
 * @param {boolean} [inTextOnlyElement] - Whether the template sits inside an element that cannot hold comments.
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
export function renderToString(
  template,
  window,
  inRawTextElement = false,
  inTextOnlyElement = false
) {
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
      const content = template.textContent ?? '';
      if (content === '') return inTextOnlyElement ? '' : EMPTY_TEXT_MARKER;
      return inRawTextElement ? content : escapeHTML(content);
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
      return renderChildren(
        template.childNodes,
        window,
        inRawTextElement,
        inTextOnlyElement
      );
    }

    if (template instanceof window.Element) {
      const tagName = template.tagName.toLowerCase();
      const isRawTextElement = rawTextElements.has(template.tagName);
      const isTextOnlyElement = textOnlyElements.has(template.tagName);

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

        text += renderChildren(
          template.childNodes,
          window,
          isRawTextElement,
          isTextOnlyElement
        );

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
    return renderChildren(
      template,
      window,
      inRawTextElement,
      inTextOnlyElement
    );
  }

  return '';
}

/**
 * @param {Iterable<JSX.Template>} children
 * @param {Window & globalThis | VDom.VWindow} window
 * @param {boolean} [inRawTextElement]
 * @param {boolean} [inTextOnlyElement]
 */
function renderChildren(
  children,
  window,
  inRawTextElement = false,
  inTextOnlyElement = false
) {
  let text = '';
  let previousEndsWithText = false;
  for (const child of children) {
    /*
     * The parser merges adjacent text nodes, so a separator is needed between
     * siblings that both carry text. Text-only elements cannot hold comments,
     * so their children are serialized as one merged text run instead.
     */
    if (
      !inTextOnlyElement &&
      previousEndsWithText &&
      startsWithText(child, window)
    ) {
      text += SPLIT_TEXT_MARKER;
    }
    text += renderToString(child, window, inRawTextElement, inTextOnlyElement);
    previousEndsWithText = endsWithText(child, window);
  }
  return text;
}

/**
 * @param {any} node
 * @param {Window & globalThis | VDom.VWindow} window
 * @returns {boolean}
 */
function startsWithText(node, window) {
  if (Array.isArray(node))
    return node.length > 0 && startsWithText(node[0], window);
  if (isPrimitiveText(node) || isTextNode(node, window)) return true;
  if (isFragment(node, window)) {
    const children = Array.from(/** @type {any} */ (node).childNodes);
    return children.length > 0 && startsWithText(children[0], window);
  }
  return false;
}

/**
 * @param {any} node
 * @param {Window & globalThis | VDom.VWindow} window
 * @returns {boolean}
 */
function endsWithText(node, window) {
  if (Array.isArray(node))
    return node.length > 0 && endsWithText(node[node.length - 1], window);
  if (isPrimitiveText(node) || isTextNode(node, window)) return true;
  if (isFragment(node, window)) {
    const children = Array.from(/** @type {any} */ (node).childNodes);
    return (
      children.length > 0 && endsWithText(children[children.length - 1], window)
    );
  }
  return false;
}

/** @param {any} node */
const isPrimitiveText = (node) =>
  typeof node === 'string' ||
  typeof node === 'number' ||
  typeof node === 'boolean';

/**
 * @param {any} node
 * @param {Window & globalThis | VDom.VWindow} window
 */
const isTextNode = (node, window) =>
  typeof node?.nodeType === 'number' && node.nodeType === window.Node.TEXT_NODE;

/**
 * @param {any} node
 * @param {Window & globalThis | VDom.VWindow} window
 */
const isFragment = (node, window) =>
  typeof node?.nodeType === 'number' &&
  node.nodeType === window.Node.DOCUMENT_FRAGMENT_NODE;

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
