/** @import { VElement, VNode, VWindow } from 'retend/v-dom' */
/** @import {
 *    BuildOptions,
 *    ServerContext,
 *    RenderOptions,
 * } from './types.js'
 */
/** @import { ChildNode } from 'domhandler' */

import { resolve } from 'node:path';
import { promises as fs } from 'node:fs';
import { parseDocument } from 'htmlparser2';
import { Comment, Text, Element } from 'domhandler';
import { addMetaListener } from './meta.js';

export class OutputArtifact {}
export class HtmlOutputArtifact extends OutputArtifact {
  /**
   * @param {string} name
   * @param {VWindow} contents
   * @param {() => Promise<string>} stringify
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
 * @param {string[]} paths The paths to serialize.
 * @param {BuildOptions} options Options for building, including optional skipRedirects.
 * @returns {Promise<(HtmlOutputArtifact | RedirectOutputArtifact)[]>} A promise that resolves to an array of output artifacts.
 *
 * @example
 * // Build a single path
 * await buildPaths(['/home'], { routerPath: './router.ts' });
 *
 * // Build multiple paths
 * await buildPaths(['/home', '/about', '/contact'], { routerPath: './router.ts' });
 */
export async function buildPaths(paths, options) {
  const {
    moduleRunner,
    htmlShell = await fs.readFile(resolve('./index.html'), 'utf8'),
    rootSelector = '#app',
    skipRedirects = false,
    asyncLocalStorage,
    routerModule,
  } = options;

  // Use the module-scoped instance
  // const asyncLocalStorage = new AsyncLocalStorage(); // Remove instantiation from here
  const promises = [];

  const retendModule = /** @type {typeof import('retend')} */ (
    await moduleRunner.import('retend')
  );
  const retendRenderModule = /** @type {typeof import('retend/render')} */ (
    await moduleRunner.import('retend/render')
  );
  const retendVDomModule = /** @type {typeof import('retend/v-dom')} */ (
    await moduleRunner.import('retend/v-dom')
  );

  if (routerModule.context === undefined) {
    throw new Error(
      'The router module must export the retend/context module as a named export. Please add export * as context from "retend/context"; to your router module.'
    );
  }

  if (routerModule.createRouter === undefined) {
    throw new Error(
      'The router module must export a createRouter function. Please add export function createRouter() { return createWebRouter({ ... }); } to your router module.'
    );
  }

  for (const path of paths) {
    /** @type {RenderOptions} */
    const renderOptions = {
      path,
      asyncLocalStorage,
      htmlShell,
      rootSelector,
      routerModule,
      retendModule,
      retendRenderModule,
      retendVDomModule,
      skipRedirects,
    };
    const promise = renderPath(renderOptions);
    promises.push(promise);
  }

  const outputs = (await Promise.all(promises)).flat(1);
  return outputs;
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
    retendRenderModule,
    retendVDomModule,
    skipRedirects,
  } = options;

  const { isVNode } = routerModule.context;
  const { getConsistentValues } = retendModule;
  const { renderToString } = retendRenderModule;
  const { VElement, VWindow } = retendVDomModule;

  const window = buildWindowFromHtmlText(htmlShell, VWindow);
  const teleportIdCounter = { value: 0 };
  const consistentValues = new Map();
  const globalData = new Map();
  const globalContextStore = {
    window,
    path,
    teleportIdCounter,
    consistentValues,
    globalData,
  };
  /** @type {(HtmlOutputArtifact | RedirectOutputArtifact)[]} */
  const outputs = [];

  await asyncLocalStorage.run(globalContextStore, async () => {
    const store = asyncLocalStorage.getStore();
    if (!store) throw new Error('No store found');

    const { path, window } = store;
    const shell = vNodeToObject(window.document.documentElement, VElement);

    const { document, location } = window;
    location.href = path;

    const router = routerModule.createRouter();
    const currentRoute = router.getCurrentRoute();
    router.setWindow(window);
    router.attachWindowListeners();

    addMetaListener(router, document, isVNode);

    const appElement = document.querySelector(rootSelector);
    if (!appElement) {
      console.warn('appElement not found while rendering', path);
      return;
    }
    appElement.replaceChildren(/** @type {VNode} */ (router.Outlet()));

    await router.navigate(path);

    const pageTitle = document.title;
    if (pageTitle) {
      document
        .querySelector('title')
        ?.replaceChildren(document.createTextNode(pageTitle));
    }

    document.head.append(
      document.createMarkupNode(
        '<style>retend-router-outlet,retend-router-relay,retend-teleport{display: contents;}</style>'
      )
    );

    await document.mountAllTeleports();

    // The server context can restore useful information about
    // the app for a client-side hydration.
    const consistentValues = Object.fromEntries(getConsistentValues());
    /** @type {ServerContext} */
    const ctx = {
      path,
      rootSelector,
      shell,
      consistentValues,
    };
    const payload = JSON.stringify(ctx);
    document.body.append(
      document.createMarkupNode(
        `<script data-static data-server-context type="application/json">${payload}</script>`
      )
    );

    const finalPath = currentRoute.value.fullPath;
    const name = `${finalPath.replace(/^\//, '') || 'index'}.html`;

    const stringify = async () => {
      const options = { markStaticNodes: true };
      const htmlContents = await renderToString(document, window, options);
      const contents = `<!DOCTYPE html>${htmlContents}`;
      window.close(); // destroys timeouts and intervals.
      return contents;
    };

    outputs.push(new HtmlOutputArtifact(name, window, stringify));
    if (path === finalPath || skipRedirects) return;

    // Add redirect to both HTML and _redirects file
    const redirectContent = generateRedirectHtmlContent(finalPath);
    const redirectWindow = buildWindowFromHtmlText(redirectContent, VWindow);

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
      new HtmlOutputArtifact(redirectFileName, redirectWindow, () =>
        Promise.resolve(redirectContent)
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
 * @param {VNode} node
 * @param {typeof VElement} VElement
 * @returns {Record<string, unknown>}
 */
function vNodeToObject(node, VElement) {
  /** @type {Record<string, unknown>} */
  const object = { type: node.nodeType };
  if (node instanceof VElement) {
    object.tag = node.tagName;
    const attrs = node.attributes;
    object.attrs = attrs.length
      ? attrs.reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, /** @type {Record<string, string>} */ ({}))
      : undefined;
    if (node.childNodes.length) {
      object.nodes = node.childNodes.map((node) =>
        vNodeToObject(node, VElement)
      );
    }
  } else object.text = node.textContent ?? '';
  return object;
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
