import { generateChildNodes } from '../library/utils.js';

// @ts-ignore: Deno has issues with @import tags.
/** @import { JSX } from '../jsx-runtime/index.d.ts' */

/**
 * Renders a JSX template to a string.
 *
 *
 * @param {JSX.Template} template - The JSX template to render.
 * @param {Window & typeof globalThis} window - The window object.
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
  if (
    typeof template === 'string' ||
    typeof template === 'number' ||
    typeof template === 'boolean'
  ) {
    return String(template);
  }

  if (template instanceof Promise) {
    return await renderToString(await template, window);
  }

  if (template instanceof window.DocumentFragment) {
    let textContent = '';
    for (const child of Array.from(template.childNodes)) {
      textContent += await renderToString(child, window);
    }
    return textContent;
  }

  if (template instanceof window.Node) {
    /*
     * TODO: There is a bug in happy-dom where
     * template instanceof window.Text is always false,
     * even when the nodeType is Node.TEXT_NODE
     */
    if (template.nodeType === window.Node.TEXT_NODE) {
      return template.textContent ?? '';
    }

    if (template.nodeType === window.Node.COMMENT_NODE) {
      return `<!--${template.textContent}-->`;
    }

    if (template instanceof window.Element) {
      let text = `<${template.tagName.toLowerCase()}`;

      for (const attribute of Array.from(template.attributes)) {
        text += ` ${attribute.name}="${attribute.value}"`;
      }

      text += '>';

      for (const child of Array.from(template.childNodes)) {
        text += await renderToString(child, window);
      }

      text += `</${template.tagName.toLowerCase()}>`;

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
 * @typedef RouteRenderResult
 * @property {string} content - The rendered HTML content.
 * @property {string} path - The path rendered.
 * @property {string} title - The title of the rendered page.
 */

/**
 * Renders a route to a string representation.
 *
 * @param {import('../router/index.js').Router} router - The router instance.
 * @param {string} path - The path to navigate to.
 * @param {Window & typeof globalThis} window - The window object.
 * @returns {Promise<RouteRenderResult>} The rendered HTML string.
 */
export async function renderRoute(router, path, window) {
  router.window = window;
  const outlet = router.Outlet();

  const app = document.createElement('div');
  app.id = 'app';
  document.body.prepend(app);

  app.appendChild(outlet);
  router.attachWindowListeners();

  await router.navigate(path);

  return {
    content: await renderToString(app, window),
    title: window.document.title,
    path: window.location.pathname,
  };
}

/**
 *
 * @param {Element} app
 * @param {JSX.Template} clientContent
 * @param {Window & typeof globalThis} window
 */
export async function render(app, clientContent, window) {
  const nodes = generateChildNodes(clientContent);
  if (!app.firstChild) {
    // If there is no prior content, it simply appends and moves on.
    app.append(...nodes);
    return app;
  }

  const fragment = window.document.createDocumentFragment();
  fragment.append(...nodes);

  /*** @type {ChildNode | null} */
  let currentStaticNode = app.firstChild;
  let currentAppNode = fragment.firstChild;

  const finalFragment = window.document.createDocumentFragment();
  while (currentStaticNode || currentAppNode) {
    await mergeNodes(currentStaticNode, currentAppNode, finalFragment, window);

    currentAppNode = currentAppNode?.nextSibling ?? null;
    currentStaticNode = currentStaticNode?.nextSibling ?? null;
  }

  app.replaceChildren(finalFragment);
  return app;
}

/**
 * @param {Node | null} staticNode
 * @param {Node | null} appNode
 * @param {DocumentFragment} resultFragment;
 * @param {Window & typeof globalThis} window
 */
async function mergeNodes(staticNode, appNode, resultFragment, window) {
  if (!staticNode && appNode) {
    showHydrationWarning({
      expected: await renderToString(appNode, window),
      got: null,
    });
    resultFragment.appendChild(appNode);
    return;
  }

  if (!appNode && staticNode) {
    showHydrationWarning({
      expected: null,
      got: await renderToString(staticNode, window),
    });
    resultFragment.appendChild(staticNode);
    return;
  }

  if (!appNode || !staticNode) {
    return;
  }

  if (appNode.nodeType !== staticNode.nodeType) {
    showHydrationWarning({
      expected: await renderToString(appNode, window),
      got: null,
    });
  }

  resultFragment.appendChild(appNode);
}

/**
 *
 * @param {{expected: string | null, got: string | null}} _options
 */
function showHydrationWarning(_options) {}
