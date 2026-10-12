import { annotateComponentDefinitions } from './component-definitions.js';

/**
 * Vite integration for Retend development. Component-definition metadata runs
 * before JSX is compiled; HMR injection retains its normal plugin ordering.
 */
export const retend = () => {
  let command = 'serve';
  let root = '';

  return [
    {
      name: 'vite-plugin-retend-component-definitions',
      enforce: /** @type {'pre'} */ ('pre'),
      apply: /** @type {'serve'} */ ('serve'),
      /** @param {{root: string}} config */
      configResolved(config) {
        root = config.root;
      },
      /**
       * @param {string} code
       * @param {string} id
       */
      transform(code, id) {
        if (id.includes('node_modules')) return null;
        const annotated = annotateComponentDefinitions(code, id, root);
        return annotated === code ? null : { code: annotated, map: null };
      },
    },
    {
      name: 'vite-plugin-retend',
      /** @param {{command: string}} config */
      configResolved(config) {
        command = config.command;
      },
      /**
       * @param {string} code
       * @param {string} id
       */
      transform(code, id) {
        if (command === 'build' || id.includes('node_modules')) return null;
        const isJsx =
          id.endsWith('.jsx') || id.endsWith('.tsx') || id.endsWith('.mdx');
        if (!isJsx) return null;

        return {
          code: `
import { hotReloadModule as __HMR____ } from 'retend-web/plugins/hmr';

${code}

if (import.meta.hot) {
  import.meta.hot.accept(async (newModule) => {
    __HMR____(newModule, await import(/* @vite-ignore */ import.meta.url));
  });
}
          `,
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
    },
  ];
};
