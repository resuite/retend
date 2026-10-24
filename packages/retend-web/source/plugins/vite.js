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
      /**
       * Vite names dev CSS modules from a hash of the stylesheet contents plus each rule's line
       * number, so editing a module renames every class in it. The stylesheet is swapped on HMR
       * while the rendered DOM keeps the old names, which leaves components unstyled until a
       * reload. Hashing only the path and local name keeps names stable across edits.
       *
       * The default only applies when the app has not named its own CSS modules: config returned
       * from a plugin wins over the app config, so an unconditional value would take that choice
       * away. Builds keep Vite's content-hashed defaults.
       * @param {{ css?: { modules?: { generateScopedName?: unknown } } }} config
       * @param {{ command: string }} env
       */
      config(config, env) {
        const appScopedName = config.css?.modules?.generateScopedName;
        const devScopedName =
          env.command === 'serve' && appScopedName === undefined
            ? {
                modules: {
                  generateScopedName: '[name]_[local]_[hash:base64:5]',
                },
              }
            : undefined;
        return {
          esbuild: {
            jsx: /** @type {'automatic' | 'preserve'} */ ('automatic'),
            jsxImportSource: 'retend',
          },
          css: devScopedName,
        };
      },
    },
  ];
};
