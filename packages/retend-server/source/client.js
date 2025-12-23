/// <reference types="vite/client" />

/** @import { Router } from 'retend/router' */
/** @import { ServerContext } from './types.js' */

import { runPendingSetupEffects, useObserver, setActiveRenderer } from 'retend';
import { createRouterRoot } from 'retend/router';
import { setGlobalContext } from 'retend/context';
import { addMetaListener } from './meta.js';
import { DOMRenderer } from 'retend-web';

export * from './render-to-string.js';

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
  const renderer = new DOMRenderer(window);
  setActiveRenderer(renderer);
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
  const { path } = context;

  setGlobalContext({
    teleportIdCounter: { value: 0 },
    consistentValues: new Map(Object.entries(context.consistentValues)),
    globalData: new Map(),
  });
  const renderer = new DOMRenderer(window);
  setActiveRenderer(renderer);

  const router = routerCreateFn();
  renderer.enableHydrationMode();
  const observer = useObserver();
  createRouterRoot(router);
  await renderer.hydrateChildrenWhenResolved(router.navigate(path));
  renderer.endHydration();
  router.attachWindowListeners(window);

  const preloadedLinks = window.document.head.querySelectorAll(
    '[data-retend-preload]'
  );
  for (const element of preloadedLinks) {
    element.remove();
  }
  observer.processMountedNodes();
  await runPendingSetupEffects();
  globalThis.window.dispatchEvent(new Event('hydrationcompleted'));

  return router;
}
