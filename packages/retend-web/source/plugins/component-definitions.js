import { parseSync } from 'oxc-parser';

const DEFINITION_SYMBOL = 'retend:component-definition';
const NEWLINE = 10;

/**
 * ESTree JSX nodes are `JSXElement` (self-closing tags included) and
 * `JSXFragment`. Walk the subtree to find one.
 * @param {unknown} node
 * @returns {boolean}
 */
function hasJSX(node) {
  if (typeof node !== 'object' || node === null) return false;
  const candidate = /** @type {{ type?: unknown }} */ (node);
  if (candidate.type === 'JSXElement' || candidate.type === 'JSXFragment') {
    return true;
  }
  for (const [key, value] of Object.entries(candidate)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      if (value.some(hasJSX)) return true;
      continue;
    }
    if (hasJSX(value)) return true;
  }
  return false;
}

/**
 * Exports are separate wrapper nodes in ESTree, unlike TypeScript's own AST
 * where `export` is a modifier on the declaration itself.
 * @param {any} statement
 * @returns {any}
 */
function unwrapExport(statement) {
  if (
    (statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration') &&
    statement.declaration
  ) {
    return statement.declaration;
  }
  return statement;
}

/**
 * oxc reports positions as byte offsets, so convert one to a 1-based line and
 * column, matching the coordinates the devtools source lookup expects.
 * @param {string} sourceText
 * @param {number} offset
 */
function getLineAndColumn(sourceText, offset) {
  let line = 1;
  let lineStart = 0;
  const limit = Math.min(offset, sourceText.length);
  for (let index = 0; index < limit; index++) {
    if (sourceText.charCodeAt(index) === NEWLINE) {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

/**
 * Annotate user-defined JSX component functions, not individual JSX call sites.
 * @param {string} code
 * @param {string} id
 * @param {string} root
 * @returns {string}
 */
export function annotateComponentDefinitions(code, id, root) {
  const fileName = id.split('?')[0];
  if (!/\.[jt]sx$/.test(fileName) || !code.includes('<')) return code;
  const normalizedFile = fileName.replaceAll('\\', '/');
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/, '');
  if (!normalizedFile.startsWith(`${normalizedRoot}/`)) return code;

  const { program } = parseSync(fileName, code, {
    lang: fileName.endsWith('.tsx') ? 'tsx' : 'jsx',
  });

  /** @type {{name:string,position:number}[]} */
  const declarations = [];
  for (const rawStatement of program.body) {
    const statement = unwrapExport(rawStatement);
    if (
      statement.type === 'FunctionDeclaration' &&
      statement.id &&
      statement.body
    ) {
      if (hasJSX(statement.body)) {
        declarations.push({
          name: statement.id.name,
          position: statement.id.start,
        });
      }
      continue;
    }
    if (statement.type !== 'VariableDeclaration') continue;
    for (const declarator of statement.declarations) {
      if (declarator.id.type !== 'Identifier' || !declarator.init) continue;
      const initializer = declarator.init;
      const rendersJSX =
        (initializer.type === 'ArrowFunctionExpression' ||
          initializer.type === 'FunctionExpression') &&
        hasJSX(initializer.body);
      const wrapsUniqueComponent =
        initializer.type === 'CallExpression' &&
        initializer.callee.type === 'Identifier' &&
        initializer.callee.name === 'createUnique' &&
        initializer.arguments.some(hasJSX);
      if (rendersJSX || wrapsUniqueComponent) {
        declarations.push({
          name: declarator.id.name,
          position: declarator.id.start,
        });
      }
    }
  }

  if (declarations.length === 0) return code;
  const annotations = declarations.map(({ name, position }) => {
    const { line, column } = getLineAndColumn(code, position);
    return `Object.defineProperty(${name}, Symbol.for('${DEFINITION_SYMBOL}'), { value: { fileName: ${JSON.stringify(fileName)}, lineNumber: ${line}, columnNumber: ${column} }, configurable: true });`;
  });
  return `${code}\n${annotations.join('\n')}`;
}
