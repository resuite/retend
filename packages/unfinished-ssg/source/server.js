/** @import { Router } from '@adbl/unfinished/router' */
/** @import { VNode } from '@adbl/unfinished/v-dom' */
/** @import { UserConfig } from 'vite' */
/** @import {
 *    BuildOptions,
 *    OutputArtifact,
 *    ServerContext,
 *    AsyncStorage,
 *    RenderOptions,
 *    WriteArtifactsOptions
 * } from './types.js'
 */
/** @import { ChildNode } from 'domhandler' */

import {
  getConsistentValues,
  Modes,
  setConsistentValues,
  setGlobalContext,
} from '@adbl/unfinished';
import { renderToString } from '@adbl/unfinished/render';
import { VElement, VWindow } from '@adbl/unfinished/v-dom';
import { createServer } from 'vite';

import { AsyncLocalStorage } from 'node:async_hooks';
import { dirname, resolve } from 'node:path';
import { promises as fs } from 'node:fs';

import { parseDocument } from 'htmlparser2';
import { Comment, Text, Element } from 'domhandler';

/**
 * @param {string[]} paths The paths to serialize.
 * @param {BuildOptions} [options] Options for building.
 * @returns {Promise<OutputArtifact[]>} A promise that resolves to an array of output artifacts.
 *
 * @example
 * // Build a single path
 * await buildPaths(['/home'], { routerPath: './router.ts' });
 *
 * // Build multiple paths
 * await buildPaths(['/home', '/about', '/contact'], { routerPath: './router.ts' });
 */
export async function buildPaths(paths, options = {}) {
  const {
    viteConfig = {},
    htmlShell = await fs.readFile(resolve('./index.html'), 'utf8'),
    rootSelector = '#app',
    createRouterModule: routerPath = './router',
  } = options;

  // /** @type {OutputArtifact[]} */
  // const outputs = [];
  // /** @type {UserConfig} */
  // const buildConfig = {
  //   ...viteConfig,
  //   build: {
  //     ...viteConfig.build,
  //     write: false,
  //     rollupOptions: { input: ['./index.html'] },
  //     minify: 'esbuild',
  //     cssMinify: 'esbuild',
  //   },
  // };
  // const buildResult = /** @type {ViteBuildResult} */ (
  //   /** @type {unknown} */ (await build(buildConfig))
  // );
  // const { output: viteOutputs } = buildResult;
  // let htmlShell = viteOutputs.find((o) => o.fileName === basename(htmlEntry));
  // if (htmlShell) viteOutputs.splice(viteOutputs.indexOf(htmlShell), 1);
  // else htmlShell = { fileName: '', source: '', code: '' };

  // for (const resource of viteOutputs) {
  //   const name = resource.fileName;
  //   const contents = resource.source ?? resource.code;
  //   outputs.push({ name, contents });
  // }

  /** @type {UserConfig} */
  const serverConfig = {
    ...viteConfig,
    server: { ...viteConfig.server, middlewareMode: true },
    appType: 'custom',
  };
  const server = await createServer(serverConfig);
  /** @type {AsyncLocalStorage<AsyncStorage>} */
  const asyncLocalStorage = new AsyncLocalStorage();
  const promises = [];

  for (const path of paths) {
    /** @type {RenderOptions} */
    const renderOptions = {
      path,
      routerPath,
      asyncLocalStorage,
      htmlShell,
      server,
      rootSelector,
    };
    const promise = renderPath(renderOptions);
    promises.push(promise);
  }

  const outputs = (await Promise.all(promises)).flat(1);
  await server.close();
  return outputs;
}

/**
 * @param {RenderOptions} options
 * @returns {Promise<OutputArtifact[]>}
 */
async function renderPath(options) {
  const {
    path,
    routerPath,
    asyncLocalStorage,
    htmlShell,
    server,
    rootSelector,
  } = options;
  const window = buildWindowFromHtmlText(htmlShell);
  const teleportIdCounter = { value: 0 };
  const consistentValues = new Map();
  const store = { window, path, teleportIdCounter, consistentValues };
  /** @type {OutputArtifact[]} */
  const outputs = [];

  await asyncLocalStorage.run(store, async () => {
    const context = {
      mode: Modes.VDom,
      get window() {
        const store = asyncLocalStorage.getStore();
        if (!store) throw new Error('No store found');
        return store.window;
      },
      get teleportIdCounter() {
        const store = asyncLocalStorage.getStore();
        if (!store) throw new Error('No store found');
        return store.teleportIdCounter;
      },
      get consistentValues() {
        const store = asyncLocalStorage.getStore();
        if (!store) throw new Error('No store found');
        return store.consistentValues;
      },
    };
    setGlobalContext(context);
    const store = asyncLocalStorage.getStore();
    if (!store) throw new Error('No store found');

    const { path, window } = store;
    const shell = vNodeToObject(window.document.documentElement);

    const { document, location } = window;
    location.href = path;

    const routerModule = await server.ssrLoadModule(resolve(routerPath));
    /** @type {Router} */
    const router = routerModule.createRouter();
    const currentRoute = router.getCurrentRoute();
    router.setWindow(window);
    router.attachWindowListeners();

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
        '<style>unfinished-router-outlet,unfinished-router-relay,unfinished-teleport{display: contents;}</style>'
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
    const name = `.${finalPath}.html`;
    const options = { markStaticNodes: true };
    const htmlContents = await renderToString(document, window, options);
    const contents = `<!DOCTYPE html>${htmlContents}`;
    outputs.push({ name, contents });

    if (path === finalPath) return;

    const redirectContent = generateRedirectHtmlContent(finalPath);
    /** @type {string} */
    let redirectFileName;

    if (path === '/' || path.endsWith('/')) {
      const normalizedPath = path === '/' ? '' : path.slice(1, -1);
      redirectFileName = `.${normalizedPath}/index.html`;
      if (normalizedPath === '') redirectFileName = './index.html';
    } else {
      redirectFileName = `.${path}.html`;
    }

    outputs.push({ name: redirectFileName, contents: redirectContent });
    setConsistentValues(new Map());
  });

  return outputs;
}

/**
 * Writes the provided output artifacts to a directory on disk.
 * @param {OutputArtifact[]} artifacts
 * @param {WriteArtifactsOptions} [options={}]
 * @returns {Promise<void>}
 */
export async function writeArtifactsToDisk(artifacts, options = {}) {
  const { outDir = 'dist', clean = false } = options;
  if (clean) await fs.rm(outDir, { recursive: true, force: true });

  await fs.mkdir(outDir, { recursive: true });

  for (const artifact of artifacts) {
    const assetPath = resolve(outDir, artifact.name);
    await fs.mkdir(dirname(assetPath), { recursive: true });
    await fs.writeFile(assetPath, artifact.contents, 'utf8');
  }
}

/**
 * @param {string} htmlText
 * @returns {VWindow}
 */
function buildWindowFromHtmlText(htmlText) {
  const parsedHtml = parseDocument(htmlText, {});
  const window = new VWindow();

  for (const node of parsedHtml.childNodes) {
    const element = createVNodeFromParsedNode(node, window);
    if (element instanceof VElement && element.tagName === 'HTML') {
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
 * @returns {Record<string, unknown>}
 */
function vNodeToObject(node) {
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
      object.nodes = node.childNodes.map(vNodeToObject);
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

// const viteConfig: UserConfig = {
//   resolve: {
//     alias: { '@': resolve(process.cwd(), './') },
//   },
//   plugins: [hmrPlugin()],
//   esbuild: {
//     jsx: 'automatic',
//     jsxImportSource: '@adbl/unfinished',
//   },
//   css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
// };
