/// <reference types="vite/client" />

import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import wasm from '@resvg/resvg-wasm/index_bg.wasm';

type OgMetadata = { title: string; description: string };

declare const __DOC_METADATA__: Record<string, OgMetadata>;

const ogLogo = `<g transform="translate(100, 100) scale(0.6)">
<rect x="2.99155" y="2.99155" width="171.017" height="171.017" rx="26.9239" stroke="#FFBA75" stroke-width="5.9831"/>
<path d="M74.7485 91.7405C82.078 92.4224 87.8159 98.5893 87.8159 106.097V125.563C87.8159 133.526 81.3597 139.983 73.3959 139.983H53.9301C45.9664 139.983 39.5102 133.526 39.5102 125.563V106.097C39.5102 98.5893 45.2481 92.4224 52.5776 91.7405H74.7485ZM127.557 37.5159C135.521 37.5159 141.977 43.972 141.977 51.9358V71.4016C141.977 79.3654 135.521 85.8215 127.557 85.8215H108.091C100.428 85.8215 94.1616 79.8432 93.6996 72.2961H93.7348V50.5823C94.4172 43.2532 100.584 37.5159 108.091 37.5159H127.557ZM73.3959 37.5159C80.9032 37.5159 87.07 43.2532 87.7524 50.5823V72.2961H87.7875C87.3531 79.394 81.7847 85.1034 74.7485 85.7581H52.5776C45.2481 85.0762 39.5102 78.9092 39.5102 71.4016V51.9358C39.5102 43.972 45.9664 37.5159 53.9301 37.5159H73.3959Z" fill="#FFBA75"/>
</g>`;
const ogHeaders = {
  'cache-control': 'public, max-age=86400',
  'content-type': 'image/png',
};
const ogMetadataBySlug = new Map<string, OgMetadata>();

for (const [filePath, metadata] of Object.entries(__DOC_METADATA__)) {
  const segments = filePath
    .replace('../../../content/', '')
    .replace(/\.mdx$/u, '')
    .split('/')
    .filter((segment) => segment !== 'index');
  const lastSegment = segments.pop();
  if (!lastSegment) {
    continue;
  }

  ogMetadataBySlug.set(lastSegment.replace(/^\d+-/u, ''), metadata);
}

const overviewMetadata: OgMetadata = {
  title: 'retend.',
  description: 'Build incredibly fast, reactive applications',
};

let wasmReady: Promise<void> | undefined;
let fontReady: Promise<Uint8Array> | undefined;

export async function handleOgRequest(
  request: Request,
  env: any,
  ctx: any,
  url: URL
): Promise<Response | null> {
  if (!(url.pathname.startsWith('/og/') && url.pathname.endsWith('.png'))) {
    return null;
  }

  const cached = await caches.default.match(request);
  if (cached) {
    return cached;
  }

  if (wasmReady === undefined) {
    wasmReady = initWasm(wasm);
  }
  await wasmReady;
  if (fontReady === undefined) {
    fontReady = env.ASSETS.fetch(new URL(inter, url.origin))
      .then((response: Response) => response.arrayBuffer())
      .then((buffer: ArrayBuffer) => new Uint8Array(buffer));
  }
  const font = await fontReady;

  const slug = url.pathname.slice(4, -4);
  let metadata = ogMetadataBySlug.get(slug);
  if (slug === 'overview' || slug === 'preview') {
    metadata = overviewMetadata;
  }
  if (!metadata || !font) {
    return new Response('Not found', { status: 404 });
  }

  const ogTitle = metadata.title
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  const ogDescription = metadata.description
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  const image = new Resvg(
    `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="12" r="1.2" fill="#44403c" />
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="#1c1917" />
  <rect width="1200" height="630" fill="url(#dots)" />
  ${ogLogo}
  <text x="100" y="420" font-family="Inter" font-size="84" font-weight="500" fill="#ffffff" letter-spacing="-0.04em">
    ${ogTitle}
  </text>
  <text x="100" y="500" font-family="Inter" font-size="36" font-weight="400" fill="#a3a3a3" letter-spacing="-0.02em">
    ${ogDescription}
  </text>
</svg>`,
    { font: { fontBuffers: [font], defaultFontFamily: 'Inter' } }
  )
    .render()
    .asPng();
  const response = new Response(image, { headers: ogHeaders });

  ctx.waitUntil(caches.default.put(request, response.clone()));
  return response;
}
