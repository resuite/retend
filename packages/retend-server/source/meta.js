/** @import { RouteData, Router } from 'retend/router' */
/** @import { Cell } from 'retend' */
/** @import { PageMeta } from './client.js' */

import { getGlobalContext, isVNode } from 'retend/context';

/** @type {Record<keyof PageMeta, string>} */
const metaNameMap = {
  viewport: 'viewport',
  description: 'description',
  keywords: 'keywords',
  author: 'author',
  themeColor: 'theme-color',
  ogTitle: 'og:title',
  ogDescription: 'og:description',
  ogImage: 'og:image',
  ogUrl: 'og:url',
  ogType: 'og:type',
  ogLocale: 'og:locale',
  ogSiteName: 'og:site_name',
  twitterCard: 'twitter:card',
  twitterTitle: 'twitter:title',
  twitterDescription: 'twitter:description',
  twitterImage: 'twitter:image',
  charset: '',
  lang: '',
  title: '',
};

/**
 * Updates the page metadata including lang, charset, title and other meta tags
 * @param {PageMeta} newMeta - The new meta data to update the page with
 */
export function updatePageMeta(newMeta) {
  const {
    window: { document },
  } = getGlobalContext();
  const head = document.head;
  const html = document.documentElement;

  // Handle lang attribute
  if (newMeta.lang) {
    html.setAttribute('lang', newMeta.lang);
  } else if (html.getAttribute('lang') !== null) {
    html.removeAttribute('lang');
  }

  // Handle charset
  const metaTags = head.querySelectorAll('meta');
  let charsetMeta = null;
  for (let i = 0; i < metaTags.length; i++) {
    if (metaTags[i].getAttribute('charset')) {
      charsetMeta = metaTags[i];
      break;
    }
  }

  if (newMeta.charset) {
    if (!charsetMeta) {
      charsetMeta = document.createElement('meta');

      if (isVNode(charsetMeta) && isVNode(head)) {
        head.childNodes.splice(0, 0, charsetMeta);
      } else if (!isVNode(charsetMeta) && !isVNode(head)) {
        head.insertBefore(charsetMeta, head.firstChild);
      }
    }
    charsetMeta.setAttribute('charset', newMeta.charset);
  } else if (charsetMeta) {
    charsetMeta.remove();
  }

  // Handle title
  if (newMeta.title) {
    /** @type {*} */
    let titleTag = head.querySelector('title');

    if (!titleTag) {
      titleTag = document.createElement('title');
      head.append(titleTag);
    }

    const newText = document.createTextNode(newMeta.title);
    titleTag.replaceChildren(newText);
  }

  // Handle all other meta tags
  for (const key of Object.keys(metaNameMap)) {
    if (key === 'lang' || key === 'charset' || key === 'title') continue;

    const metaName = metaNameMap[/** @type {keyof PageMeta} */ (key)];
    const newValue = newMeta[/** @type {keyof PageMeta} */ (key)];

    const metaTags = head.querySelectorAll('meta');
    let metaTag = null;

    for (let i = 0; i < metaTags.length; i++) {
      if (metaTags[i].getAttribute('name') === metaName) {
        metaTag = metaTags[i];
        break;
      }
    }

    if (newValue) {
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', metaName);
        head.append(/** @type {*} */ (metaTag));
      }
      if (metaTag.getAttribute('content') !== newValue) {
        metaTag.setAttribute('content', newValue);
      }
    } else if (metaTag) {
      metaTag.remove();
    }
  }
}

/**
 * Adds a listener to the window object to update the page meta data
 * @param {Router} router - The router instance
 * @returns {void}
 */
export function addMetaListener(router) {
  /** @type {Cell<RouteData>} */
  const currentPath = Reflect.get(router, 'currentPath');
  currentPath.runAndListen((data) => {
    const { metadata } = data;
    if (metadata) {
      const entries = Object.fromEntries(metadata.entries());
      updatePageMeta(entries);
    }
  });
}
