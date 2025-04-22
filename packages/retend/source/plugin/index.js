/**
 * A Vite plugin to enable hot module replacement (HMR) for JSX and TSX files
 * in the Vite build environment. This plugin specifically targets files with
 * `.jsx` or `.tsx` extensions, excluding files in the `node_modules` directory.
 *
 * @returns A Vite plugin object with a `name` property and `transform` hook.
 */
export const retend = () => {
  return {
    name: 'vite-plugin-retend',

    /**
     * @param {string} code - The source code of the module being transformed.
     * @param {string} id - The unique identifier (path) of the module.
     * @returns {{code: string, map: null} | null} An object with the transformed code
     * and a null source map, or `null` if the module should not be transformed.
     */
    transform(code, id) {
      if (id.includes('node_modules')) {
        return null;
      }

      const isJsx = id.endsWith('.jsx') || id.endsWith('.tsx');

      if (!isJsx) return null;

      const injectedCode = `
import { hotReloadModule as __HMR____ } from 'retend/plugin/hmr';

${code}

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    __HMR____(newModule, import.meta.url);
  });
}
      `;

      return {
        code: injectedCode,
        map: null,
      };
    },
    config() {
      return {
        esbuild: {
          jsx: /** @type {'automatic' | 'preserve'} */ ('automatic'),
          jsxImportSource: 'retend',
        },
      };
    },
  };
};
