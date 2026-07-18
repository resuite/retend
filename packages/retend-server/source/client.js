/// <reference types="vite/client" />

/** @import { Router } from 'retend/router' */
/** @import { JSX } from 'retend/jsx-runtime' */

import {
  Await,
  getState,
  runPendingSetupEffects,
  waitForAsyncBoundaries,
} from 'retend';
import { DOMRenderer } from 'retend-web';
import { getGlobalContext, setGlobalContext } from 'retend/context';
import { createRouterRoot } from 'retend/router';

import { addMetaListener } from './meta.js';

const HYDRATION_CLEANUP = Symbol.for('retend.hydration.cleanup');
let hydrating = false;

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
 * @property {string} [ogLogo]
 * The Open Graph logo image URL, specified using <meta property="og:logo">.
 * A brand image used by consumers that support the tag.
 * Example: "https://example.com/logo.png"
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
 * @typedef {Object} HydrationOptions
 * @property {string} [rootId] The ID of the root element to hydrate. Defaults to "app".
 * @property {(root: JSX.Template) => JSX.Template} [wrap] Wraps the routed app before rendering or hydration.
 */

/**
 * Re-enables the interactive features of a server-side rendered application.
 *
 * @param {() => Router} routerFn - The function used to create the router.
 * @param {HydrationOptions} options - Customizations for hydration behaviour.
 * @returns {Promise<Router>} The router instance used to create the application.
 */
export async function hydrate(routerFn, options = {}) {
  if (hydrating) {
    throw new Error('A Retend hydration transaction is already in progress.');
  }
  hydrating = true;
  const rootId = options.rootId ?? 'app';
  try {
    return await hydrateRouter(routerFn, rootId, options);
  } finally {
    hydrating = false;
  }
}

/**
 * @param {() => Router} routerFn
 * @param {string} rootId
 * @param {HydrationOptions} options
 */
async function hydrateRouter(routerFn, rootId, options) {
  const root = document.getElementById(rootId);
  if (!root) throw new Error('No root element found');
  const previousContext = getGlobalContext();
  const previousCleanup = previousContext.globalData.get(HYDRATION_CLEANUP);
  previousCleanup?.();
  const renderer = new DOMRenderer(window);
  const context = { globalData: new Map(), renderer };
  setGlobalContext(context);

  try {
    const router = routerFn();
    const detachRouter = router.attachWindowListeners(window);
    try {
      const { location } = window;
      await router.navigate(
        location.pathname + location.search + location.hash
      );

      const shouldHydrate = root.getAttribute('data-retend-hydration') === '1';
      if (shouldHydrate) renderer.enableHydrationMode(root);
      else root.replaceChildren();
      const rendered = renderer.render(() =>
        Await({
          fallback: null,
          children: () =>
            options.wrap
              ? options.wrap(() => createRouterRoot(router))
              : createRouterRoot(router),
        })
      );
      if (shouldHydrate) {
        await renderer.endHydration();
        root.removeAttribute('data-retend-hydration');
      } else {
        const nodes = Array.isArray(rendered) ? rendered : [rendered];
        root.append(...nodes.filter((node) => node && !node.isConnected));
        await waitForAsyncBoundaries();
        await runPendingSetupEffects();
        await waitForAsyncBoundaries();
        window.dispatchEvent(new Event('hydrationcompleted'));
      }
      addMetaListener(router, document);
      const rootState = getState().node;
      context.globalData.set(HYDRATION_CLEANUP, () => {
        detachRouter();
        rootState.dispose();
      });
      return router;
    } catch (error) {
      detachRouter();
      throw error;
    }
  } catch (error) {
    getState().node.dispose();
    if (previousCleanup) setGlobalContext({ globalData: new Map() });
    else setGlobalContext(previousContext);
    throw error;
  }
}
