import ts from 'typescript';

/**
 * A Vite plugin to enable hot module replacement (HMR) for JSX and TSX files
 * in the Vite build environment. This plugin specifically targets files with
 * `.jsx` or `.tsx` extensions, excluding files in the `node_modules` directory.
 *
 * @returns A Vite plugin object with a `name` property and `transform` hook.
 */
export const retend = () => {
  let command = 'serve';

  return {
    name: 'vite-plugin-retend',
    /** @param {{ command: string }} config */
    configResolved(config) {
      command = config.command;
    },

    /**
     * @param {string} code - The source code of the module being transformed.
     * @param {string} id - The unique identifier (path) of the module.
     * @returns {{code: string, map: null} | null} An object with the transformed code
     * and a null source map, or `null` if the module should not be transformed.
     */
    transform(code, id) {
      if (command === 'build') {
        return null;
      }

      if (id.includes('node_modules')) {
        return null;
      }

      const isJsx = id.endsWith('.jsx') || id.endsWith('.tsx');

      if (!isJsx) return null;

      const sourceFile = ts.createSourceFile(
        id,
        code,
        ts.ScriptTarget.Latest,
        true,
        id.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
      );
      const componentDefinitions = [];

      for (const statement of sourceFile.statements) {
        if (ts.isFunctionDeclaration(statement)) {
          if (!statement.name) {
            continue;
          }
          const componentName = statement.name.text;
          if (!/^[A-Z]/u.test(componentName)) {
            continue;
          }
          const definitionPosition = sourceFile.getLineAndCharacterOfPosition(
            statement.name.getStart(sourceFile)
          );
          componentDefinitions.push({
            componentName,
            lineNumber: definitionPosition.line + 1,
            columnNumber: definitionPosition.character + 1,
          });
          continue;
        }

        if (!ts.isVariableStatement(statement)) {
          continue;
        }

        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) {
            continue;
          }
          const componentName = declaration.name.text;
          if (!/^[A-Z]/u.test(componentName)) {
            continue;
          }
          const initializer = declaration.initializer;
          if (!initializer) {
            continue;
          }
          if (
            !ts.isArrowFunction(initializer) &&
            !ts.isFunctionExpression(initializer)
          ) {
            continue;
          }

          const definitionPosition = sourceFile.getLineAndCharacterOfPosition(
            declaration.name.getStart(sourceFile)
          );
          componentDefinitions.push({
            componentName,
            lineNumber: definitionPosition.line + 1,
            columnNumber: definitionPosition.character + 1,
          });
        }
      }

      let normalizedId = id;
      const queryIndex = normalizedId.indexOf('?');
      if (queryIndex > -1) {
        normalizedId = normalizedId.slice(0, queryIndex);
      }

      let definitionMetadata = '';
      for (const definition of componentDefinitions) {
        definitionMetadata += `
${definition.componentName}.__retendDefinition = { fileName: ${JSON.stringify(normalizedId)}, lineNumber: ${definition.lineNumber}, columnNumber: ${definition.columnNumber} };
`;
      }

      const injectedCode = `
import { hotReloadModule as __HMR____ } from 'retend-web/plugin/hmr';

${code}
${definitionMetadata}

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
