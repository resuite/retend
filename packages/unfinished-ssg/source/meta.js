import { getGlobalContext, isVNode } from '@adbl/unfinished';

/**
 * @typedef {Object} PageMeta
 *
 * @property {string} [author]
 * The name or identifier of the individual or entity who created the page's content.
 *
 * @property {string} [description]
 * A brief summary or overview of the page's content, typically used in meta tags for SEO or previews.
 *
 * @property {string} [lang]
 * The primary language of the page, specified using a standard language code (e.g., "en" for English).
 *
 * @property {string} [charset]
 * The character encoding standard used for the page, such as "UTF-8" or "ISO-8859-1".
 *
 * @property {string} [themeColor]
 * A color value (e.g., "#ffffff") defining the suggested theme or accent color for the page, often for browser UI.
 *
 * @property {string} [keywords]
 * A comma-separated list of words or phrases relevant to the page's content, used for search engine indexing.
 *
 * @property {string} [ogTitle]
 * The title of the page as defined for Open Graph protocol, used when sharing on social platforms like Facebook.
 *
 * @property {string} [ogDescription]
 * A concise description of the page for Open Graph, displayed in social media previews.
 *
 * @property {string} [ogImage]
 * The URL of an image representing the page in Open Graph, shown in social media shares.
 *
 * @property {string} [ogUrl]
 * The canonical URL of the page for Open Graph, linking to the page in social media contexts.
 *
 * @property {string} [ogType]
 * The type of content (e.g., "article", "website") as defined by Open Graph for social media categorization.
 *
 * @property {string} [ogLocale]
 * The locale of the page for Open Graph, in the format "language_TERRITORY" (e.g., "en_US").
 *
 * @property {string} [ogSiteName]
 * The name of the website hosting the page, used in Open Graph for branding in social shares.
 *
 * @property {string} [twitterCard]
 * The Twitter Card type (e.g., "summary", "summary_large_image"), controlling how the page appears when shared on Twitter.
 *
 * @property {string} [twitterTitle]
 * The title of the page optimized for Twitter sharing, displayed in Twitter Card previews.
 *
 * @property {string} [twitterDescription]
 * A short description of the page for Twitter Cards, shown in Twitter share previews.
 *
 * @property {string} [twitterImage]
 * The URL of an image for Twitter Cards, representing the page in Twitter shares.
 *
 * @property {string} [title]
 * The main title of the page, typically displayed in the browser tab or as the primary heading.
 *
 * @property {string} [viewport]
 * The viewport settings for the page (e.g., "width=device-width, initial-scale=1"), controlling display on different devices.
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
