/// <reference types="vite/client" />

/** @import { JsxElement } from 'retend' */
/** @import { VDocument } from 'retend/v-dom' */
/** @import { Router } from 'retend/router' */
/** @import { JSX } from 'retend/jsx-runtime' */
/** @import { ServerContext } from './types.js' */

import {
  runPendingSetupEffects,
  setAttributeFromProps,
  useObserver,
} from 'retend';
import {
  setGlobalContext,
  Modes,
  getGlobalContext,
  matchContext,
  isSSREnvironment,
} from 'retend/context';

import {
  HydrationUpgradeEvent,
  VComment,
  VElement,
  VWindow,
  VNode,
} from 'retend/v-dom';
import { SourceCell } from 'retend';
import { addMetaListener } from './meta.js';
import { createRouterRoot } from './utils.js';

const OUTLET_INTERNAL_KEYS = ['__originScopeSnapshot'];

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
    // In dev mode, we default to an SPA.
    return defaultToSpaMode(routerFn);
  }

  const contextScript = document.querySelector('script[data-server-context]');
  if (!contextScript) {
    console.warn(
      '[retend-server] No server-side context found. Falling back to SPA mode.'
    );
    const router = await defaultToSpaMode(routerFn);
    return router;
  }

  const context = JSON.parse(contextScript.textContent ?? '{}');
  const router = await restoreContext(context, routerFn);
  addMetaListener(router, document);
  return router;
}

/** @param {() => Router} routerFn  */
async function defaultToSpaMode(routerFn) {
  const router = routerFn();
  router.attachWindowListeners(window);
  const root = document.querySelector('#app');
  root?.append(/** @type {Node} */ (createRouterRoot(router)));
  globalThis.window.dispatchEvent(new Event('hydrationcompleted'));
  addMetaListener(router, document);
  await runPendingSetupEffects();
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

  recreateVWindow(shell, vWindow);
  setGlobalContext({
    mode: Modes.VDom,
    window: vWindow,
    teleportIdCounter: { value: 0 },
    consistentValues: new Map(Object.entries(context.consistentValues)),
    globalData: new Map(),
  });

  const observer = useObserver();
  const router = routerCreateFn();
  router.attachWindowListeners(window);

  const vAppRoot = vWindow.document.querySelector(rootSelector);
  if (!vAppRoot) throw new Error(`Root element "${rootSelector}" not found`);

  vAppRoot.append(/** @type {VNode} */ (createRouterRoot(router)));
  await router.navigate(path);
  await vWindow.document.mountAllTeleports();

  const htmlRoot = webWindow.document.documentElement;
  const vHtmlRoot = vWindow.document.documentElement;

  await hydrateDomNode(htmlRoot, vHtmlRoot)
    .then(() => {
      observer.processMountedNodes();
      const preloadedLinks = window.document.head.querySelectorAll(
        '[data-retend-preload]'
      );
      for (const element of preloadedLinks) {
        element.remove();
      }
    })
    .catch((error) => {
      console.error('Hydration error: ', error);
    });

  const hydratedGlobalData = getGlobalContext().globalData;

  setGlobalContext({
    mode: Modes.Interactive,
    window,
    teleportIdCounter: { value: 0 },
    consistentValues: new Map(),
    globalData: hydratedGlobalData,
  });

  router.attachWindowListeners(window);
  Reflect.set(globalThis.window.document, '__appRouterInstance', router);
  await runPendingSetupEffects();
  globalThis.window.dispatchEvent(new Event('hydrationcompleted'));

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
async function hydrateDomNode(node, vNode) {
  const subPromises = [];
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
      data.relatedCell.ignore(data);
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
      ref.set(node);
    }

    // Port outlet data.
    if (vNode.tagName === 'RETEND-ROUTER-OUTLET') {
      for (const key of OUTLET_INTERNAL_KEYS) {
        Reflect.set(node, key, Reflect.get(vNode, key));
      }
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
      ref.set(node);
    }
  }

  // Hydrate Shadow roots
  if (node instanceof Element) {
    // If shadowRoot exists, hydrate it
    if (node.shadowRoot && vNode instanceof VElement && vNode.shadowRoot) {
      subPromises.push(
        hydrateDomNode(node.shadowRoot, vNode.shadowRoot).catch((error) => {
          console.error('Shadow root hydration error:', error);
        })
      );
    }

    // Cleanup templates for browsers without DSD support
    const templates = node.querySelectorAll('template[shadowrootmode]');
    for (const template of templates) {
      template.remove();
    }
  }

  // Hydrate Children.

  const textSplitNodes = [];
  for (
    let realNodeIndex = 0, vNodeIndex = 0;
    realNodeIndex < node.childNodes.length &&
    vNodeIndex < vNode.childNodes.length;
    realNodeIndex++, vNodeIndex++
  ) {
    const nodeChild = node.childNodes[realNodeIndex];
    const mirrorChild = vNode.childNodes[vNodeIndex];
    if (!mirrorChild || !nodeChild) continue;

    if (mirrorChild instanceof NoHydrateVNode) {
      realNodeIndex += mirrorChild.targetNodeSpan - 1;
      continue;
    }

    if (
      mirrorChild.nodeType === Node.COMMENT_NODE &&
      '__promise' in mirrorChild &&
      mirrorChild.__promise instanceof Promise
    ) {
      try {
        // Once the promise resolves, the node will automatically swap itself with
        // the result in the virtual dom tree, so we just have to await.
        await mirrorChild.__promise;
        vNodeIndex--;
        realNodeIndex--;
      } catch (error) {
        console.error('Hydration error: ', error);
      }
      continue;
    }

    const isTextSplittingComment =
      nodeChild.nodeType === Node.COMMENT_NODE &&
      nodeChild.textContent === '@@' &&
      node.childNodes[realNodeIndex - 1]?.nodeType === Node.TEXT_NODE;

    if (isTextSplittingComment) {
      textSplitNodes.push(nodeChild);
      // Handle text nodes that were supposed to be preserved
      // but were removed by HTML parsing.
      if (node.childNodes[realNodeIndex + 1]?.nodeType !== Node.TEXT_NODE) {
        nodeChild.after(document.createTextNode(''));
      }
      vNodeIndex--;
    } else
      subPromises.push(
        hydrateDomNode(nodeChild, mirrorChild).catch((error) => {
          console.error('Hydration error: ', error);
        })
      );
  }

  // Dispatch final hydration callbacks. This will update
  // For loop caches and other listeners.
  vNode.dispatchEvent(new HydrationUpgradeEvent(node));

  for (const textSplitNode of textSplitNodes) textSplitNode.remove();
  await Promise.allSettled(subPromises);
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

export class NoHydrateVNode extends VNode {
  /**
   * @param {VDocument} document
   * @param {number} count
   */
  constructor(document, count) {
    super(document);
    this.targetNodeSpan = count;
  }
}

/**
 * @typedef {((props: any) => JSX.Template) | (() => JSX.Template)} Component
 */

/**
 *
 * Creates a static component that does not hydrate on the client.
 * This is useful for components that don't need interactivity and can be safely skipped
 * for a faster hydration process.
 *
 * While retend already has a mechanism for skipping hydration on the node level
 * (via the `data-static` attribute), this function allows you to skip the first
 * client-side initialization of a component altogether, improving performance.
 *
 * @template {Component} TemplateFunction
 * @param {TemplateFunction} component - The original component to be potentially converted to a static node.
 *                                        This component should return a JSX template.
 * @param {number} [nodeCount=1] - The number of root nodes the component returns.
 *                                 Must be specified correctly if your component returns multiple root nodes.
 *                                 Defaults to 1 if not specified.
 * @returns {TemplateFunction} The original component in client-side rendering,
 *                              or a non-hydrating virtual node in server-side rendering.
 *
 * @remarks
 * - This function only affects the initial hydration. On subsequent client-side renders
 *   (e.g., after navigation), the original component will be used.
 * - This is different from the `data-static` attribute, which still performs some hydration work, but skips the final interactivity transfer step.
 * - _Use this for truly static content that never needs to be interactive_. If you try to use
 *   cells or other reactive features within the component, it will lead to unexpected behavior.
 *
 * @example
 * // Basic usage with a simple header
 * const StaticHeader = noHydrate(() => (
 *   <header>Static Content</header>
 * ));
 *
 * @example
 * // Usage with a component that returns multiple root nodes
 * const StaticFooterLinks = noHydrate(() => {
 *   return (
 *    <>
 *     <router.Link href="/about">About</router.Link>
 *     <router.Link href="/terms">Terms</router.Link>
 *     <router.Link href="/contact">Contact</router.Link>
 *    </>
 *   );
 * }, 3); // Specify the number of root nodes (3 links)
 *
 * @example
 * // Usage in a larger component
 * function App() {
 *   return (
 *     <div>
 *       <StaticHeader />
 *       <main>...</main>
 *       <footer>
 *         <StaticFooterLinks />
 *       </footer>
 *     </div>
 *   );
 * }
 */
export function noHydrate(component, nodeCount = 1) {
  return /** @type {TemplateFunction} */ (
    (props) => {
      if (!isSSREnvironment()) {
        const { window } = getGlobalContext();
        if (matchContext(window, Modes.VDom)) {
          const { document } = window;
          return new NoHydrateVNode(document, nodeCount);
        }
      }
      return component(props);
    }
  );
}
