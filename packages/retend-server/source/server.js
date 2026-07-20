/** @import { VNode } from './v-dom/index.js' */
/** @import {
 *    BuildOptions,
 *    RenderOptions,
 * } from './types.js'
 */
/** @import { ChildNode } from 'domhandler' */
/** @import { VWindow } from './v-dom/index.js'; */

import { Comment, Element, Text } from 'domhandler';
import { parseDocument } from 'htmlparser2';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

import { addMetaListener } from './meta.js';
import { renderToString } from './render-to-string.js';

export class OutputArtifact {}
export class HtmlOutputArtifact extends OutputArtifact {
  /**
   * @param {string} name
   * @param {VWindow} contents
   * @param {() => string} stringify
   */
  constructor(name, contents, stringify) {
    super();
    this.name = name;
    this.contents = contents;
    this.stringify = stringify;
  }
}

export class RedirectOutputArtifact extends OutputArtifact {
  /**
   * @param {string} name
   * @param {string} contents
   */
  constructor(name, contents) {
    super();
    this.name = name;
    this.contents = contents;
  }
}

/**
 * @param {string} path The path to serialize.
 * @param {BuildOptions} options Options for building, including optional skipRedirects.
 * @returns {Promise<(HtmlOutputArtifact | RedirectOutputArtifact)[]>} A promise that resolves to an array of output artifacts.
 */
export async function buildPath(path, options) {
  const {
    htmlShell = await fs.readFile(resolve('./index.html'), 'utf8'),
    rootSelector = '#app',
    skipRedirects = false,
    asyncLocalStorage,
    routerModule,
    retendModule,
    vdomModule,
    retendRouterModule,
  } = options;

  /** @type {RenderOptions} */
  const renderOptions = {
    path,
    asyncLocalStorage,
    htmlShell,
    rootSelector,
    routerModule,
    retendModule,
    retendRouterModule,
    skipRedirects,
    vdomModule,
  };

  return renderPath(renderOptions);
}

/**
 * @param {RenderOptions} options
 * @returns {Promise<(HtmlOutputArtifact | RedirectOutputArtifact)[]>}
 */
async function renderPath(options) {
  const {
    path,
    asyncLocalStorage,
    htmlShell,
    rootSelector,
    retendModule,
    routerModule,
    retendRouterModule,
    skipRedirects,
    vdomModule,
  } = options;

  const window = buildWindowFromHtmlText(htmlShell, vdomModule.VWindow);
  const renderer = new vdomModule.VDOMRenderer(window);

  /** @type {(HtmlOutputArtifact | RedirectOutputArtifact)[]} */
  const outputs = [];

  await asyncLocalStorage.run(
    { renderer, path, globalData: new Map([['env:ssr', true]]) },
    async () => {
      const { document, location } = window;
      location.href = path;

      const router = routerModule.createRouter();
      const currentRoute = router.getCurrentRoute();
      // @ts-expect-error: window is mocked by vdom.
      router.attachWindowListeners(window);

      addMetaListener(router, document);

      const appElement = document.querySelector(rootSelector);
      if (!appElement) {
        console.warn('appElement not found while rendering', path);
        return;
      }
      appElement.setAttribute('data-retend-hydration', '1');
      const renderedRoot = renderer.render(() =>
        retendModule.Await({
          children: () => retendRouterModule.createRouterRoot(router),
        })
      );
      appElement.replaceChildren(...[renderedRoot].flat());

      await router.navigate(path);
      await retendModule.waitForAsyncBoundaries();
      let stalledTeleports = false;
      while (document.teleportMounts.length) {
        const resolved = await document.mountAllTeleports();
        await retendModule.waitForAsyncBoundaries();
        if (!resolved && stalledTeleports) {
          throw new Error('Could not resolve Teleport target.');
        }
        stalledTeleports = resolved === 0;
      }

      if (document.title) {
        document
          .querySelector('title')
          ?.replaceChildren(document.createTextNode(document.title));
      }

      const finalPath = currentRoute.get().fullPath;
      const name = `${finalPath.replace(/^\//, '') || 'index'}.html`;

      const stringify = () => {
        const contents = `<!DOCTYPE html>${renderToString(document, window)}`;
        window.close(); // destroys timeouts and intervals.
        return contents;
      };

      outputs.push(new HtmlOutputArtifact(name, window, stringify));
      if (path === finalPath || skipRedirects) return;

      // Add redirect to both HTML and _redirects file
      const redirectContent = generateRedirectHtmlContent(finalPath);
      const redirectWindow = buildWindowFromHtmlText(
        redirectContent,
        vdomModule.VWindow
      );

      // Create redirect entry for _redirects file
      const redirectEntry = `${path} ${finalPath} 301`;
      outputs.push(
        new RedirectOutputArtifact('_redirects', `${redirectEntry}\n`)
      );

      const normalizedPath = path === '/' ? '' : path.slice(1, -1);
      const redirectFileName = path.endsWith('/')
        ? `${normalizedPath ? `${normalizedPath}/` : ''}index.html`
        : `${path.replace(/^\/+/, '')}.html`;

      outputs.push(
        new HtmlOutputArtifact(
          redirectFileName,
          redirectWindow,
          () => redirectContent
        )
      );
    }
  );

  return outputs;
}

/**
 * @param {string} htmlText
 * @param {typeof VWindow} VWindowConstructor
 * @returns {VWindow}
 */
function buildWindowFromHtmlText(htmlText, VWindowConstructor) {
  const parsedHtml = parseDocument(htmlText, {});
  const window = new VWindowConstructor();

  for (const node of parsedHtml.childNodes) {
    const element = createVNodeFromParsedNode(node, window);
    if (element instanceof window.HTMLElement && element.tagName === 'HTML') {
      window.document.documentElement = element;
      const newHead = element.querySelector('head');
      const newBody = element.querySelector('body');
      if (newHead) window.document.head = newHead;
      if (newBody) window.document.body = newBody;
    } else if (element) window.document.body.append(element);
  }

  return window;
}

/**
 * @param {ChildNode} node
 * @param {VWindow} window
 * @returns {VNode | null}
 */
function createVNodeFromParsedNode(node, window) {
  const { document } = window;
  if (node instanceof Element) {
    const vElement = document.createElement(node.tagName.toLowerCase());
    for (const attr of node.attributes) {
      vElement.setAttribute(attr.name, attr.value);
    }
    for (const child of node.childNodes) {
      const childNode = createVNodeFromParsedNode(child, window);
      if (childNode) vElement.append(childNode);
    }
    return vElement;
  }
  if (node instanceof Text) {
    // Skips formatting text nodes.
    if (!node.data.trim()) return null;
    return document.createTextNode(node.data);
  }
  if (node instanceof Comment) return document.createComment(node.data);
  return window.document.createMarkupNode(String(node));
}

/**
 * @param {string} finalPath
 * @returns {string}
 */
function generateRedirectHtmlContent(finalPath) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="refresh" content="0; url=${finalPath}.html">
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to <a href="${finalPath}.html">${finalPath}</a></p>
</body>
</html>`;
}
