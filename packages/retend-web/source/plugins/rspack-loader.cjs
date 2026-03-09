const query = '?retend-rspack-hmr-proxy';

/**
 * @this {{ resourcePath: string, resourceQuery: string, mode: string }}
 * @param {string} source
 * @returns {string}
 */
module.exports = function retendRspackLoader(source) {
  if (this.mode !== 'development') {
    return source;
  }

  if (this.resourceQuery === query) {
    return source;
  }

  if (this.resourcePath.includes('node_modules')) {
    return source;
  }

  const isJsx =
    this.resourcePath.endsWith('.jsx') ||
    this.resourcePath.endsWith('.tsx') ||
    this.resourcePath.endsWith('.mdx');

  if (!isJsx) {
    return source;
  }

  const proxy = JSON.stringify(`${this.resourcePath}${query}`);
  const hasDefaultExport = /\bexport\s+default\b/.test(source);
  const defaultExport = hasDefaultExport
    ? `export default __RETEND_HMR_MODULE__.default;`
    : '';

  return `
import * as __RETEND_HMR_MODULE__ from ${proxy};
import { hotReloadModule as __HMR____ } from 'retend-web/plugins/hmr';

export * from ${proxy};
${defaultExport}

let __RETEND_PREVIOUS_MODULE__ = { ...__RETEND_HMR_MODULE__ };

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept(${proxy}, () => {
    const __RETEND_NEXT_MODULE__ = { ...__RETEND_HMR_MODULE__ };
    __HMR____(
      __RETEND_NEXT_MODULE__,
      __RETEND_PREVIOUS_MODULE__
    );
    __RETEND_PREVIOUS_MODULE__ = __RETEND_NEXT_MODULE__;
  });
}
`;
};
