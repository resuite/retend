import { getGlobalContext, isVNode } from '@adbl/unfinished';

/**
 * @typedef {Object} PageMeta
 *
 * @property {string} [author]
 * The author of the page
 *
 * @property {string} [description]
 * The description of the page
 *
 * @property {string} [lang]
 * The language of the page
 *
 * @property {string} [charset]
 * The character set of the page
 *
 * @property {string} [themeColor]
 * The theme color of the page
 *
 * @property {string} [keywords]
 * The keywords of the page
 *
 * @property {string} [ogTitle]
 * The Open Graph title of the page
 *
 * @property {string} [ogDescription]
 * The Open Graph description of the page
 *
 * @property {string} [ogImage]
 * The Open Graph image of the page
 *
 * @property {string} [ogUrl]
 * The Open Graph URL of the page
 *
 * @property {string} [ogType]
 * The Open Graph type of the page
 *
 * @property {string} [ogLocale]
 * The Open Graph locale of the page
 *
 * @property {string} [ogSiteName]
 * The Open Graph site name of the page
 *
 * @property {string} [twitterCard]
 * The Twitter Card of the page
 *
 * @property {string} [twitterTitle]
 * The Twitter title of the page
 *
 * @property {string} [twitterDescription]
 * The Twitter description of the page
 *
 * @property {string} [twitterImage]
 * The Twitter image of the page
 *
 * @property {string} [title]
 * The title of the page
 *
 * @property {string} [viewport]
 * The viewport of the page
 */

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
