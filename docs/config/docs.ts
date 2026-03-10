import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const docsRoot = path.resolve(__dirname, '..');
const docsOgRoot = path.resolve(docsRoot, 'public/og');
const docsPages = new Set<string>();
docsPages.add('/docs');
const collapsedSections = new Set([
  'built-in-utilities',
  'advanced-components',
  'ssr-and-ssg',
]);
const docsOgLogo = `<g transform="translate(100, 100) scale(0.6)">
<rect x="2.99155" y="2.99155" width="171.017" height="171.017" rx="26.9239" stroke="#FFBA75" stroke-width="5.9831"/>
<path d="M74.7485 91.7405C82.078 92.4224 87.8159 98.5893 87.8159 106.097V125.563C87.8159 133.526 81.3597 139.983 73.3959 139.983H53.9301C45.9664 139.983 39.5102 133.526 39.5102 125.563V106.097C39.5102 98.5893 45.2481 92.4224 52.5776 91.7405H74.7485ZM127.557 37.5159C135.521 37.5159 141.977 43.972 141.977 51.9358V71.4016C141.977 79.3654 135.521 85.8215 127.557 85.8215H108.091C100.428 85.8215 94.1616 79.8432 93.6996 72.2961H93.7348V50.5823C94.4172 43.2532 100.584 37.5159 108.091 37.5159H127.557ZM73.3959 37.5159C80.9032 37.5159 87.07 43.2532 87.7524 50.5823V72.2961H87.7875C87.3531 79.394 81.7847 85.1034 74.7485 85.7581H52.5776C45.2481 85.0762 39.5102 78.9092 39.5102 71.4016V51.9358C39.5102 43.972 45.9664 37.5159 53.9301 37.5159H73.3959Z" fill="#FFBA75"/>
</g>`;

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

mkdirSync(docsOgRoot, { recursive: true });

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

  const slug = normalizedSegments[normalizedSegments.length - 1] || 'overview';
  const ogTitle = (title || 'Retend Documentation')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  const ogDescription = (
    description ||
    'Retend is a modern, lightweight runtime to build incredibly fast, reactive web applications.'
  )
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');

  writeFileSync(
    path.join(docsOgRoot, `${slug}.svg`),
    `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0f0f0f" />
      <stop offset="100%" stop-color="#1a1a1a" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity="0.05" />
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="1200" height="630" fill="url(#grid)" />
  ${docsOgLogo}
  <text x="230" y="165" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="600" fill="#FFBA75" letter-spacing="-0.02em">
    Retend Documentation
  </text>
  <text x="100" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="82" font-weight="700" fill="#ffffff" letter-spacing="-0.03em">
    ${ogTitle}
  </text>
  <text x="100" y="430" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="400" fill="#d4d4d4">
    ${ogDescription}
  </text>
  <rect x="100" y="490" width="80" height="8" rx="4" fill="#FFBA75" />
</svg>`
  );

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

writeFileSync(
  path.join(docsOgRoot, 'overview.svg'),
  `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0f0f0f" />
      <stop offset="100%" stop-color="#1a1a1a" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity="0.05" />
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="1200" height="630" fill="url(#grid)" />
  ${docsOgLogo}
  <text x="230" y="165" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="600" fill="#FFBA75" letter-spacing="-0.02em">
    Retend Documentation
  </text>
  <text x="100" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="82" font-weight="700" fill="#ffffff" letter-spacing="-0.03em">
    Retend
  </text>
  <text x="100" y="430" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="400" fill="#d4d4d4">
    A simpler way to build user interfaces.
  </text>
  <rect x="100" y="490" width="80" height="8" rx="4" fill="#FFBA75" />
</svg>`
);

export { docsPages };
