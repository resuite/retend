/** @import { VNode } from './v-dom/index.js' */
/** @import {
 *    BuildOptions,
 *    ServerContext,
 *    RenderOptions,
 * } from './types.js'
 */
/** @import { ChildNode } from 'domhandler' */
/** @import { VWindow, VDOMRenderer } from './v-dom/index.js'; */

import { resolve } from 'node:path';
import { promises as fs } from 'node:fs';
import { parseDocument } from 'htmlparser2';
import { Comment, Text, Element } from 'domhandler';
import { addMetaListener } from './meta.js';
import { renderToString } from './render-to-string.js';

export class OutputArtifact {}
export class HtmlOutputArtifact extends OutputArtifact {
  /**
   * @param {string} name
   * @param {VWindow} contents
   * @param {() => Promise<string>} stringify
   * @param {Set<string>} cssImports
   */
  constructor(name, contents, stringify, cssImports) {
    super();
    this.name = name;
    this.contents = contents;
    this.stringify = stringify;
    this.cssImports = cssImports;
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
    retendRenderModule,
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
    retendRenderModule,
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

  const { getConsistentValues } = retendModule;

  const window = buildWindowFromHtmlText(htmlShell, vdomModule.VWindow);
  const renderer = new vdomModule.VDOMRenderer(window, {
    markDynamicNodes: true,
  });

  const teleportIdCounter = { value: 0 };
  const consistentValues = new Map();
  const globalData = new Map();
  const cssImports = new Set();
  globalData.set('env:ssr', true);
  retendModule.setActiveRenderer(renderer, globalData);
  const globalContextStore = {
    path,
    teleportIdCounter,
    consistentValues,
    globalData,
    cssImports,
  };
  /** @type {(HtmlOutputArtifact | RedirectOutputArtifact)[]} */
  const outputs = [];

  await asyncLocalStorage.run(globalContextStore, async () => {
    const store = asyncLocalStorage.getStore();
    if (!store) throw new Error('No store found');

    const { path } = store;
    /** @type {VDOMRenderer} */ // @ts-expect-error
    const renderer = retendModule.getActiveRenderer();
    const { host: window } = renderer;

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
    appElement.replaceChildren(retendRouterModule.createRouterRoot(router));

    await router.navigate(path);

    const pageTitle = document.title;
    if (pageTitle) {
      document
        .querySelector('title')
        ?.replaceChildren(document.createTextNode(pageTitle));
    }

    await document.mountAllTeleports();

    // The server context can restore useful information about
    // the app for a client-side hydration.
    const consistentValues = Object.fromEntries(getConsistentValues());
    /** @type {ServerContext} */
    const ctx = {
      path,
      consistentValues,
    };
    const payload = JSON.stringify(ctx);
    document.body.append(
      document.createMarkupNode(
        `<script data-static data-server-context type="application/json">${payload}</script>`
      )
    );

    const finalPath = currentRoute.get().fullPath;
    const name = `${finalPath.replace(/^\//, '') || 'index'}.html`;

    const stringify = async () => {
      const htmlContents = await renderToString(document, window);
      const contents = `<!DOCTYPE html>${htmlContents}`;
      window.close(); // destroys timeouts and intervals.
      return contents;
    };

    outputs.push(new HtmlOutputArtifact(name, window, stringify, cssImports));
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

    /** @type {string} */
    let redirectFileName;

    if (path === '/' || path.endsWith('/')) {
      const normalizedPath = path === '/' ? '' : path.slice(1, -1);
      redirectFileName = `${normalizedPath}/index.html`;
      if (normalizedPath === '') redirectFileName = 'index.html';
    } else {
      redirectFileName = `${path.replace(/^\/+/, '')}.html`;
    }

    outputs.push(
      new HtmlOutputArtifact(
        redirectFileName,
        redirectWindow,
        () => Promise.resolve(redirectContent),
        cssImports
      )
    );
  });

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
