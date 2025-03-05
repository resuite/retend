import {
  getConsistentValues,
  Modes,
  setConsistentValues,
  setGlobalContext,
} from '@adbl/unfinished';
import { renderToString } from '@adbl/unfinished/render';
import { VElement, type VNode, VWindow } from '@adbl/unfinished/v-dom';
import type { Router } from '@adbl/unfinished/router';
import { build, createServer, type UserConfig } from 'vite';

import { AsyncLocalStorage } from 'node:async_hooks';
import { basename, dirname, resolve } from 'node:path';
import { promises as fs } from 'node:fs';

import { parseDocument } from 'htmlparser2';
import { Comment, Text, type ChildNode, Element } from 'domhandler';
import type {
  BuildOptions,
  OutputArtifact,
  ViteBuildResult,
  ServerContext,
  AsyncStorage,
  WriteArtifactsOptions,
  RenderOptions,
} from './types.ts';

/**
 * Given the path to a client-side router, this function serializes the given paths to
 * HTML files and related assets.
 *
 * @param paths The paths to serialize.
 * @param options Options for building.
 * @returns A promise that resolves to an array of output artifacts.
 *
 * @example
 * // Build a single path
 * await buildPaths(['/home'], { routerPath: './router.ts' });
 *
 * // Build multiple paths
 * await buildPaths(['/home', '/about', '/contact'], { routerPath: './router.ts' });
 */
export async function buildPaths(paths: string[], options: BuildOptions = {}) {
  const outputs: Array<OutputArtifact> = [];
  const {
    viteConfig = {},
    htmlEntry = './index.html',
    rootSelector = '#app',
    createRouterModule: routerPath = './router',
  } = options;

  const buildConfig: UserConfig = {
    ...viteConfig,
    build: {
      ...viteConfig.build,
      write: false,
      rollupOptions: { input: ['./index.html'] },
      minify: 'esbuild',
      cssMinify: 'esbuild',
    },
  };
  const buildResult = (await build(buildConfig)) as unknown as ViteBuildResult;
  const { output: viteOutputs } = buildResult;
  let htmlShell = viteOutputs.find((o) => o.fileName === basename(htmlEntry));
  if (htmlShell) viteOutputs.splice(viteOutputs.indexOf(htmlShell), 1);
  else htmlShell = { fileName: '', source: '', code: '' };

  for (const resource of viteOutputs) {
    const name = resource.fileName;
    const contents = resource.source ?? resource.code;
    outputs.push({ name, contents });
  }

  const serverConfig: UserConfig = {
    ...viteConfig,
    server: { ...viteConfig.server, middlewareMode: true },
    appType: 'custom',
  };
  const server = await createServer(serverConfig);
  const asyncLocalStorage = new AsyncLocalStorage<AsyncStorage>();
  const promises = [];

  for (const path of paths) {
    const htmlShellSource = htmlShell.source;
    const renderOptions: RenderOptions = {
      path,
      routerPath,
      asyncLocalStorage,
      htmlShellSource,
      server,
      rootSelector,
    };
    const promise = renderPath(renderOptions);
    promises.push(promise);
  }

  await Promise.all(promises);
  await server.close();
  return outputs;
}

async function renderPath(options: RenderOptions) {
  const {
    path,
    routerPath,
    asyncLocalStorage,
    htmlShellSource,
    server,
    rootSelector,
  } = options;
  const window = buildWindowFromHtmlText(htmlShellSource);
  const teleportIdCounter = { value: 0 };
  const consistentValues = new Map();
  const store = { window, path, teleportIdCounter, consistentValues };
  const outputs: OutputArtifact[] = [];

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
    const router: Router = routerModule.createRouter();
    const currentRoute = router.getCurrentRoute();
    router.setWindow(window);
    router.attachWindowListeners();

    const appElement = document.querySelector(rootSelector);
    if (!appElement) {
      console.warn('appElement not found while rendering', path);
      return;
    }
    appElement.replaceChildren(router.Outlet() as VNode);

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
    const ctx: ServerContext = {
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
    let redirectFileName: string;

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
 * @returns A Promise that resolves when all artifacts have been written to disk.
 */
export async function writeArtifactsToDisk(
  artifacts: Array<OutputArtifact>,
  options: WriteArtifactsOptions = {}
) {
  const { outDir = 'dist', clean = false } = options;
  if (clean) await fs.rm(outDir, { recursive: true, force: true });

  await fs.mkdir(outDir, { recursive: true });

  for (const artifact of artifacts) {
    const assetPath = resolve(outDir, artifact.name);
    await fs.mkdir(dirname(assetPath), { recursive: true });
    await fs.writeFile(assetPath, artifact.contents, 'utf8');
  }
}

function buildWindowFromHtmlText(htmlText: string) {
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

function createVNodeFromParsedNode(
  node: ChildNode,
  window: VWindow
): VNode | null {
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

function vNodeToObject(node: VNode) {
  const object: Record<string, unknown> = { type: node.nodeType };
  if (node instanceof VElement) {
    object.tag = node.tagName;
    const attrs = node.attributes;
    object.attrs = attrs.length
      ? attrs.reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {} as Record<string, string>)
      : undefined;
    if (node.childNodes.length) {
      object.nodes = node.childNodes.map(vNodeToObject);
    }
  } else object.text = node.textContent ?? '';
  return object;
}

function generateRedirectHtmlContent(finalPath: string) {
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
