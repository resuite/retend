/// <reference types="vite/client" />

/** @import { JsxElement } from 'retend' */
/** @import { VNode } from 'retend/v-dom' */
/** @import { Router } from 'retend/router' */
/** @import { ServerContext } from './types.js' */

import { setAttributeFromProps, useObserver } from 'retend';
import { setGlobalContext, Modes } from 'retend/context';
import { upgradeAnchorTag } from 'retend/router';
import {
  HydrationUpgradeEvent,
  VComment,
  VElement,
  VWindow,
} from 'retend/v-dom';
import { SourceCell } from 'retend';
import { addMetaListener } from './meta.js';

/**
 * @template [M={}]
 * @typedef {Object} PageMeta
 *
 * @property {string} [author]
 * The author of the page, specified using the <meta name="author"> tag.
 * Example: "John Doe"
 *
 * @property {string} [description]
 * The meta description of the page, used by search engines in search results.
 * Specified using the <meta name="description"> tag.
 * Example: "A comprehensive guide to web development best practices and techniques"
 *
 * @property {string} [lang]
 * The language of the page, specified using the lang attribute on the <html> element.
 * Example: "en" for English, "es" for Spanish
 *
 * @property {string} [charset]
 * The character encoding of the page, specified using the <meta charset> tag.
 * Example: "UTF-8"
 *
 * @property {string} [themeColor]
 * The theme color for mobile browsers, specified using <meta name="theme-color">.
 * Used for browser UI elements like the address bar.
 * Example: "#ff0000" for red
 *
 * @property {string} [keywords]
 * Keywords relevant to the page content, specified using <meta name="keywords">.
 * Used by some search engines for indexing.
 * Example: "web development, JavaScript, HTML, CSS"
 *
 * @property {string} [ogTitle]
 * The Open Graph title for social media sharing, specified using <meta property="og:title">.
 * Used when the page is shared on platforms like Facebook.
 * Example: "My Awesome Website"
 *
 * @property {string} [ogDescription]
 * The Open Graph description for social media sharing, specified using <meta property="og:description">.
 * Appears in social media previews.
 * Example: "Discover amazing content on our website"
 *
 * @property {string} [ogImage]
 * The Open Graph image URL for social media sharing, specified using <meta property="og:image">.
 * The image shown when shared on social platforms.
 * Example: "https://example.com/image.jpg"
 *
 * @property {string} [ogUrl]
 * The canonical Open Graph URL, specified using <meta property="og:url">.
 * The preferred URL for the page when shared.
 * Example: "https://example.com/page"
 *
 * @property {string} [ogType]
 * The Open Graph content type, specified using <meta property="og:type">.
 * Describes the type of content being shared.
 * Example: "website", "article", "product"
 *
 * @property {string} [ogLocale]
 * The Open Graph locale, specified using <meta property="og:locale">.
 * Indicates the language and territory of the content.
 * Example: "en_US", "es_ES"
 *
 * @property {string} [ogSiteName]
 * The Open Graph site name, specified using <meta property="og:site_name">.
 * The overall site name for social sharing context.
 * Example: "My Website Name"
 *
 * @property {string} [twitterCard]
 * The Twitter Card type, specified using <meta name="twitter:card">.
 * Controls the appearance of shared content on Twitter.
 * Example: "summary", "summary_large_image"
 *
 * @property {string} [twitterTitle]
 * The Twitter-specific title, specified using <meta name="twitter:title">.
 * Used when the content is shared on Twitter.
 * Example: "Check out this awesome article"
 *
 * @property {string} [twitterDescription]
 * The Twitter-specific description, specified using <meta name="twitter:description">.
 * Appears in Twitter card previews.
 * Example: "An in-depth look at modern web development"
 *
 * @property {string} [twitterImage]
 * The Twitter-specific image URL, specified using <meta name="twitter:image">.
 * The image shown in Twitter card previews.
 * Example: "https://example.com/twitter-image.jpg"
 *
 * @property {string} [title]
 * The page title, specified using the <title> tag in the document head.
 * Appears in browser tabs and search results.
 * Example: "Home Page | My Website"
 *
 * @property {string} [viewport]
 * The viewport configuration, specified using <meta name="viewport">.
 * Controls how the page is displayed on mobile devices.
 * Example: "width=device-width, initial-scale=1.0"
 *
 * @property {M} [misc]
 * Represents other custom metadata that does not pertain to HTML.
 */

/**
 * Re-enables the interactive features of a server-side rendered application.
 *
 * This function is the entry point for client-side hydration, taking a `routerModule`,
 * and using it to re-initialize the application's router,
 * attaching it to the existing static HTML. This process makes the app
 * interactive without a full page reload, improving user experience.
 *
 * @param {() => Router} routerFn - The function used to create the router
 * on the server.
 * @returns {Promise<Router>} The re-initiated instance of the router used to create the application.
 *   This allows you to interact with the router programmatically after hydration.
 *
 * @example
 * // In your main client-side entry point (e.g., index.js or app.js):
 * import { hydrate } from 'retend-server/client';
 * import { createRouter } from './router';
 *
 * hydrate(createRouter)
 *   .then(() => {
 *     console.log('Application successfully hydrated!');
 *   })
 *   .catch((error) => {
 *     console.error('Hydration failed:', error);
 *   });
 * @remarks
 * After hydration, the global `window` object will have a `hydrationcompleted` event dispatched.
 * This event can be listened to to confirm that hydration has completed successfully.
 * ```js
 *  window.addEventListener('hydrationcompleted', () => {
 *    console.log('Hydration complete!');
 *  });
 * ```
 */
export async function hydrate(routerFn) {
  if (import.meta.env.DEV) {
    // Default to SPA mode in development.
    return defaultToSpaMode(routerFn);
  }

  const contextScript = document.querySelector('script[data-server-context]');
  if (!contextScript) {
    console.warn(
      '[retend-server] No server-side context found. Falling back to SPA mode.'
    );
    const router = defaultToSpaMode(routerFn);
    activateLinks(router);
    return router;
  }

  const context = JSON.parse(contextScript.textContent ?? '{}');
  const router = await restoreContext(context, routerFn);
  contextScript.remove();
  addMetaListener(router);
  activateLinks(router);
  return router;
}

/** @param {() => Router} routerFn  */
function defaultToSpaMode(routerFn) {
  const router = routerFn();
  router.setWindow(window);
  router.attachWindowListeners();
  const root = document.querySelector('#app');
  root?.append(/** @type {Node} */ (router.Outlet()));
  globalThis.window.dispatchEvent(new Event('hydrationcompleted'));
  addMetaListener(router);
  return router;
}

/**
 * Restores the server-side application context and re-initializes the client-side application.
 *
 * This function is a crucial step in the hydration process.  It takes the server-rendered
 * context (containing information about the application's state, root element, etc.) and
 * uses it to re-initialize the application's router and attach it to the existing HTML.
 *
 * @param {ServerContext} context - The server-rendered context, containing data about the application
 *  state, root element, and other consistent values.
 * @param {() => Router} routerCreateFn - The `createRouter` function used
 *  to create the application's router.
 */
async function restoreContext(context, routerCreateFn) {
  const { shell, path, rootSelector } = context;
  const vWindow = new VWindow();
  const webWindow = window;
  const observer = useObserver();

  recreateVWindow(shell, vWindow);
  setGlobalContext({
    mode: Modes.VDom,
    window: vWindow,
    teleportIdCounter: { value: 0 },
    consistentValues: new Map(Object.entries(context.consistentValues)),
  });

  const router = routerCreateFn();
  router.setWindow(vWindow);
  router.attachWindowListeners();

  const vAppRoot = vWindow.document.querySelector(rootSelector);
  if (!vAppRoot) throw new Error(`Root element "${rootSelector}" not found`);

  vAppRoot.append(/** @type {VNode} */ (router.Outlet()));
  await router.navigate(path);
  await vWindow.document.mountAllTeleports();

  const htmlRoot = webWindow.document.documentElement;
  const vHtmlRoot = vWindow.document.documentElement;

  hydrateDomNode(htmlRoot, vHtmlRoot)
    .then(() => {
      globalThis.window.dispatchEvent(new Event('hydrationcompleted'));
      observer.processMountedNodes();
    })
    .catch((error) => {
      console.error('Hydration error: ', error);
    });

  setGlobalContext({
    mode: Modes.Interactive,
    window,
    teleportIdCounter: { value: 0 },
    consistentValues: new Map(),
  });

  router.setWindow(window);
  router.attachWindowListeners();
  Reflect.set(globalThis.window.document, '__appRouterInstance', router);

  return router;
}

/**
 * Hydrates a single DOM node and its children with the associated virtual DOM node's data.
 *
 * This function recursively traverses the DOM, applying the necessary updates
 * to ensure that the real DOM matches the virtual DOM. This includes re-establishing
 * reactivity connections and porting various properties.
 *
 * @param {Node} node - The real DOM node to hydrate.
 * @param {VNode} vNode - The corresponding virtual DOM node.
 * @returns {Promise<void>} A promise that resolves when the node and its children have been hydrated.
 *
 * @remarks
 * This function is used internally by the `hydrate` function and is not intended for direct use.
 * It handles tasks such as:
 *
 * -   Setting attributes
 * -   Re-establishing event listeners
 * -   Setting ref values
 */
function hydrateDomNode(node, vNode) {
  return new Promise(() => {
    // Static nodes have been verified to contain no reactivity.
    // by the server, so we can skip hydration.
    if (node instanceof Element && node.hasAttribute('data-static')) return;

    // Propagate reactivity connections.
    const cellData = vNode.getRelatedCellData();
    if (cellData?.size) {
      const newSet = /** @type {typeof cellData} */ (new Set());
      for (const data of cellData) {
        if (!(data instanceof Function)) {
          newSet.add(data);
          continue;
        }
        if (!data.originalFunction || !data.relatedCell) continue;
        const reboundFn = /** @type {typeof data} */ (
          data.originalFunction.bind(node)
        );
        data.relatedCell.listen(reboundFn, { weak: true });
        newSet.add(reboundFn);
      }
      Reflect.set(node, '__attributeCells', newSet);
    }

    if (node instanceof Element && vNode instanceof VElement) {
      // Port hidden attributes: event listeners, etc.
      for (const [name, value] of vNode.hiddenAttributes) {
        setAttributeFromProps(/** @type {JsxElement} */ (node), name, value);
      }
      // Port ref values.
      const ref = Reflect.get(vNode, '__ref');
      if (ref instanceof SourceCell) {
        Reflect.set(node, '__ref', ref);
        ref.value = node;
      }
    }

    // Port range symbols.
    if (node instanceof Comment && vNode instanceof VComment) {
      const commentRangeSymbol = Reflect.get(vNode, '__commentRangeSymbol');
      if (commentRangeSymbol) {
        Reflect.set(node, '__commentRangeSymbol', commentRangeSymbol);
      }

      // Port ref values
      const ref = Reflect.get(vNode, '__ref');
      if (ref instanceof SourceCell) {
        Reflect.set(node, '__ref', ref);
        ref.value = node;
      }
    }

    // Hydrate Shadow roots
    if (node instanceof Element) {
      // If shadowRoot exists, hydrate it
      if (node.shadowRoot && vNode instanceof VElement && vNode.shadowRoot) {
        hydrateDomNode(node.shadowRoot, vNode.shadowRoot).catch((error) => {
          console.error('Shadow root hydration error:', error);
        });
      }

      // Cleanup templates for browsers without DSD support
      const templates = node.querySelectorAll('template[shadowrootmode]');
      for (const template of templates) {
        template.remove();
      }
    }

    // Hydrate Children.
    let offset = 0;
    const textSplitNodes = [];
    for (let i = 0; i < node.childNodes.length; i++) {
      const nodeChild = node.childNodes[i];
      const mirrorChild = vNode.childNodes[i - offset];
      if (!mirrorChild) continue;

      const isTextSplittingComment =
        nodeChild.nodeType === Node.COMMENT_NODE &&
        nodeChild.textContent === '@@' &&
        node.childNodes[i - 1]?.nodeType === Node.TEXT_NODE &&
        node.childNodes[i + 1]?.nodeType === Node.TEXT_NODE;

      if (isTextSplittingComment) {
        textSplitNodes.push(nodeChild);
        offset++;
      } else
        hydrateDomNode(nodeChild, mirrorChild).catch((error) => {
          console.error('Hydration error: ', error);
        });
    }

    // Dispatch final hydration callbacks. This will update
    // For loop caches and other listeners.
    vNode.dispatchEvent(new HydrationUpgradeEvent(node));

    for (const textSplitNode of textSplitNodes) textSplitNode.remove();
  });
}

/**
 * Recreates a virtual DOM structure from a serialized representation.
 *
 * This function takes a JSON-like object representing a virtual DOM node and
 * recursively reconstructs the corresponding `VNode` tree. This is essential
 * during the hydration process to create a virtual representation of the
 * server-rendered HTML.
 *
 * @param {Record<string, unknown>} obj - A serialized object representing a `VNode`.
 *   This object should contain properties such as `type`, `tag`, `attrs`, and `nodes`
 *   that describe the structure and attributes of the virtual DOM node.
 * @param {VWindow} window - The `VWindow` instance to which the recreated `VNode`
 *   will be attached.  This is the virtual window that will contain the
 *   recreated virtual DOM.
 * @returns {VNode} The recreated `VNode` (virtual DOM node).
 */
function recreateVWindow(obj, window) {
  const { document } = window;
  if (obj.type === 1) {
    // Element node
    const element = document.createElement(/** @type {string} */ (obj.tag));
    if (obj.tag === 'HTML') window.document.documentElement = element;
    if (obj.tag === 'HEAD') window.document.head = element;
    if (obj.tag === 'BODY') window.document.body = element;

    if (obj.attrs) {
      for (const [name, value] of Object.entries(obj.attrs)) {
        element.setAttribute(name, value);
      }
    }

    if (obj.nodes) {
      const childNodes = /** @type {Array<Record<string, unknown>>} */ (
        obj.nodes
      );
      for (const childObj of childNodes) {
        element.append(recreateVWindow(childObj, window));
      }
    }

    return element;
  }
  if (obj.type === 8)
    return document.createComment(/** @type {string} */ (obj.text));
  return document.createTextNode(/** @type {string} */ (obj.text));
}

/**
 * Reactivates the router linking behavior that was disabled
 * during SSG.
 * @param {Router} router
 */
function activateLinks(router) {
  /** @type {NodeListOf<HTMLAnchorElement>} */
  const links = document.querySelectorAll('a[data-router-link]');
  for (const link of links) {
    upgradeAnchorTag(link, router);
  }
}
