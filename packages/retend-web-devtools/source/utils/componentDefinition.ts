import type { JSX } from 'retend/jsx-runtime';

import type { ComponentTreeNode } from '@/core/devtools-renderer';

const definitionKey = Symbol.for('retend:component-definition');

export function getComponentDefinition(
  node: ComponentTreeNode
): JSX.JSXDevFileData | null {
  const value: unknown = Reflect.get(node.component, definitionKey);
  if (!value || typeof value !== 'object') return null;

  const { fileName, lineNumber, columnNumber } = value as Record<
    string,
    unknown
  >;
  if (
    typeof fileName !== 'string' ||
    !fileName ||
    !Number.isSafeInteger(lineNumber) ||
    !Number.isSafeInteger(columnNumber) ||
    (lineNumber as number) < 1 ||
    (columnNumber as number) < 1
  )
    return null;

  return {
    fileName,
    lineNumber: lineNumber as number,
    columnNumber: columnNumber as number,
  };
}
