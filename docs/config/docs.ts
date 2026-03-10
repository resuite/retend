import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

const docsRoot = path.resolve(__dirname, '..');
const docsPages = new Set<string>();
docsPages.add('/docs');
const collapsedSections = new Set([
  'built-in-utilities',
  'advanced-components',
  'ssr-and-ssg',
]);

const metadataFromMarkdown = (content: string) => {
  let title = '';
  let description = '';

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n*/u);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim().replace(/^['"]|['"]$/gu, '');
    }

    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      description = descMatch[1].trim().replace(/^['"]|['"]$/gu, '');
    }
  }

  return { title, description };
};

const headingIdFromLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-');

const headingLabelFromMarkdown = (value: string) => {
  let result = value.replace(/\[[^\]]*\]\([^)]*\)/gu, (segment) => {
    const closingBracket = segment.indexOf(']');
    if (closingBracket < 1) return '';
    return segment.slice(1, closingBracket);
  });
  result = result.replace(/`([^`]+)`/gu, '$1');
  result = result.replace(/[*_~]/gu, '');
  result = result.replace(/<[^>]+>/gu, '');
  return result.trim();
};

const headingListFromMarkdown = (content: string) => {
  const headingIdCount = new Map<string, number>();
  const headings: Array<{
    id: string;
    selector: `#${string}`;
    label: string;
    depth: number;
  }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    let depth = 0;
    let rawLabel = '';

    if (line.startsWith('## ')) {
      depth = 2;
      rawLabel = line.slice(3);
    } else if (line.startsWith('### ')) {
      depth = 3;
      rawLabel = line.slice(4);
    } else if (line.startsWith('#### ')) {
      depth = 4;
      rawLabel = line.slice(5);
    } else {
      continue;
    }

    const label = headingLabelFromMarkdown(rawLabel);
    if (label === '') {
      continue;
    }

    let id = headingIdFromLabel(label);
    if (id === '') {
      continue;
    }

    const seenCount = headingIdCount.get(id) ?? 0;
    headingIdCount.set(id, seenCount + 1);
    if (seenCount > 0) {
      id = `${id}-${seenCount}`;
    }

    headings.push({ id, selector: `#${id}`, label, depth });
  }

  return headings;
};

export const addHeadingIds =
  () =>
  (tree: {
    children?: Array<{
      children?: unknown[];
      data?: { hProperties?: Record<string, string> };
      depth?: number;
      value?: string;
    }>;
  }) => {
    const headingIdCount = new Map<string, number>();

    const textFromNode = (node: { children?: unknown[]; value?: string }) => {
      let result = node.value ?? '';
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          result += textFromNode(
            child as { children?: unknown[]; value?: string }
          );
        }
      }
      return result;
    };

    if (!Array.isArray(tree.children)) return;

    for (const node of tree.children) {
      if (node.depth !== 2 && node.depth !== 3 && node.depth !== 4) continue;

      const label = textFromNode(node).trim();
      if (label === '') continue;

      let id = headingIdFromLabel(label);
      if (id === '') continue;

      const seenCount = headingIdCount.get(id) ?? 0;
      headingIdCount.set(id, seenCount + 1);
      if (seenCount > 0) {
        id = `${id}-${seenCount}`;
      }

      node.data ??= {};
      node.data.hProperties ??= {};
      node.data.hProperties.id = id;
    }
  };

export const docsMetadataByPath: Record<
  string,
  {
    headings: Array<{
      id: string;
      label: string;
      depth: number;
    }>;
    title: string;
    description: string;
  }
> = {};

const docsContentFiles = globSync('content/**/*.mdx', {
  cwd: docsRoot,
}).toSorted();

for (const docsContentFile of docsContentFiles) {
  const source = readFileSync(path.resolve(docsRoot, docsContentFile), 'utf8');
  const headings = headingListFromMarkdown(source);
  const { title, description } = metadataFromMarkdown(source);

  docsMetadataByPath[`../../../${docsContentFile}`] = {
    headings,
    title,
    description,
  };

  const segments = docsContentFile
    .replace(/^content\//u, '')
    .replace(/\.mdx$/u, '')
    .split('/');

  const normalizedSegments: string[] = [];
  for (const segment of segments) {
    if (segment === 'index') continue;
    normalizedSegments.push(segment.replace(/^\d+-/u, ''));
  }

  let page = '/docs';
  if (normalizedSegments.length > 0) {
    page = `${page}/${normalizedSegments.join('/')}`;
  }

  if (page === '/docs/getting-started') {
    continue;
  }

  if (normalizedSegments.length > 1) {
    if (collapsedSections.has(normalizedSegments[0])) {
      continue;
    }
    if (normalizedSegments[0] === 'under-the-hood') {
      if (normalizedSegments[1] !== 'api-reference') {
        continue;
      }
    }
  }

  docsPages.add(page);
}

export { docsPages };
