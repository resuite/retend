import type { JSX } from 'retend/jsx-runtime';

import type { ComponentTreeNode } from '@/core/devtools-renderer';

const IDENTIFIER_START = /[A-Za-z_$]/;
const IDENTIFIER_PART = /[A-Za-z0-9_$.]/;
const SOURCE_MAP_COMMENT =
  /\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m;

function extractIdentifierAt(
  source: string,
  line: number,
  column: number
): string | null {
  const lines = source.split('\n');
  const targetLine = lines[line - 1];
  if (!targetLine) return null;

  if (column >= targetLine.length) return null;
  if (!IDENTIFIER_START.test(targetLine[column])) return null;

  let end = column + 1;
  while (end < targetLine.length && IDENTIFIER_PART.test(targetLine[end])) {
    end++;
  }

  const identifier = targetLine.slice(column, end);
  if (identifier.endsWith('.')) return identifier.slice(0, -1);
  return identifier;
}

function extractOriginalSource(transformedText: string): string | null {
  const match = transformedText.match(SOURCE_MAP_COMMENT);
  if (!match) return null;

  try {
    const decoded = atob(match[1]);
    const sourceMap: Record<string, unknown> = JSON.parse(decoded);
    const sourcesContent = sourceMap.sourcesContent;
    if (!Array.isArray(sourcesContent)) return null;
    const first: unknown = sourcesContent[0];
    if (typeof first !== 'string') return null;
    return first;
  } catch {
    return null;
  }
}

async function fetchOriginalSource(
  fileName: string,
  sourceCache: Map<string, string>
): Promise<string | null> {
  const cached = sourceCache.get(fileName);
  if (cached) return cached;

  try {
    const response = await fetch(fileName);
    const text = await response.text();

    const original = extractOriginalSource(text) ?? text;
    sourceCache.set(fileName, original);
    return original;
  } catch {
    return null;
  }
}

async function resolveFromSource(
  fileData: JSX.JSXDevFileData,
  sourceCache: Map<string, string>
): Promise<string | null> {
  const source = await fetchOriginalSource(fileData.fileName, sourceCache);
  if (!source) return null;
  return extractIdentifierAt(
    source,
    fileData.lineNumber,
    fileData.columnNumber
  );
}

export function getComponentName(
  node: ComponentTreeNode,
  nameCache: WeakMap<ComponentTreeNode, string>
): string {
  const cached = nameCache.get(node);
  if (cached) return cached;
  return node.component.name || '[Anonymous]';
}

export async function resolveComponentName(
  node: ComponentTreeNode,
  sourceCache: Map<string, string>,
  nameCache: WeakMap<ComponentTreeNode, string>
): Promise<string> {
  const cached = nameCache.get(node);
  if (cached) return cached;

  const componentName = node.component.name;
  if (componentName) {
    const isAnonymousUnique =
      componentName === 'Unique.Content' &&
      Reflect.get(node.component, '__retendUnique');
    if (!isAnonymousUnique) {
      nameCache.set(node, componentName);
      return componentName;
    }
  }

  if (node.fileData) {
    const resolved = await resolveFromSource(node.fileData, sourceCache);
    if (resolved) {
      nameCache.set(node, resolved);
      return resolved;
    }
  }

  return '[Anonymous]';
}
