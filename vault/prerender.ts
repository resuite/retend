import { parseHTML } from 'linkedom';
import { renderToString } from '@adbl/unfinished/render';
import { build, createServer, type UserConfig } from 'vite';
import { resolve } from 'node:path';
import process from 'node:process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { OutputChunk, RollupOutput } from 'rollup';

const routeList = ['/home'];

/**
 * Represents a pre-rendered route with its associated metadata and content.
 */
interface RenderedRoute {
  id: string;
  title: string;
  path: string;
  pageContent: string;
}

let viteUserConfig: UserConfig = {};
const workingDirectory = process.cwd();
// Read user config if it exists.
if (existsSync(resolve(workingDirectory, './vite.config.ts'))) {
  viteUserConfig = (await import('./vite.config.ts')).default;
}
if (existsSync(resolve(workingDirectory, './vite.config.js'))) {
  viteUserConfig = (await import('./vite.config.js')).default;
}

/**
 * Pre-renders routes to static HTML content.
 *
 * @param routes - An array of route paths to pre-render.
 * @param indexHtml - The content of the index.html file.
 * @returns A promise that resolves to an array of RenderedRoute objects.
 */
export async function preRenderRoutes(routes: string[], indexHtml: string) {
  const outputHtml: RenderedRoute[] = [];

  for (const route of routes) {
    const vite = await createServer({
      ...viteUserConfig,
      server: { middlewareMode: true },
      appType: 'custom',
    });

    const dom = parseHTML(indexHtml);
    const window = dom.window as unknown as Window & typeof globalThis;
    globalThis.window = window;

    const { createRouter } = await vite.ssrLoadModule(
      resolve(workingDirectory, './source/router.ts')
    );
    const router = createRouter();
    router.window = window;
    router.attachWindowListeners();

    const root = window.document.getElementById('app');
    if (root !== null) {
      root.replaceChildren(router.Outlet());
    }
    await router.navigate(route);

    outputHtml.push({
      id: router.id,
      title: router.window.document.title,
      path: route,
      pageContent: await renderToString(root?.firstChild, window),
    });

    vite.close();
  }

  return outputHtml;
}

/**
 * Builds the project using Vite.
 *
 * @param outDir - Optional output directory for the build.
 * @returns A promise that resolves to a RollupOutput object.
 */
export async function buildProjectWithVite(
  outDir?: string
): Promise<RollupOutput> {
  const viteBuildConfig = {
    ...viteUserConfig,
    build: {
      ...(viteUserConfig.build ?? {}),
      outDir,
    },
  };
  return (await build(viteBuildConfig)) as RollupOutput;
}

/**
 * Main execution block
 *
 * This section:
 * 1. Builds the project
 * 2. Reads the generated index.html
 * 3. Pre-renders specified routes
 * 4. Generates static HTML files for each pre-rendered route
 */
const outDir =
  viteUserConfig.build?.outDir ?? resolve(workingDirectory, './dist');
const vite = await buildProjectWithVite(outDir);

const indexHtml = readFileSync(resolve(outDir, './index.html'), 'utf8');

const preRenderedRoutes = await preRenderRoutes(routeList, indexHtml);
for (const route of preRenderedRoutes) {
  const { id, title, path, pageContent } = route;

  // Generate the HTML file path for the route
  const htmlFile = resolve(outDir, `./${path}.html`).replace(/\/+/g, '/');
  const routeDir = resolve(outDir, htmlFile.split('/').slice(0, -1).join('/'));

  // Create the directory if it doesn't exist
  if (!existsSync(routeDir)) {
    mkdirSync(routeDir, { recursive: true });
  }

  // Extract imported CSS files from the Vite build output
  const importedCss = vite.output
    .filter((output): output is OutputChunk => {
      return 'viteMetadata' in output;
    })
    .flatMap((chunk) => {
      return Array.from(chunk.viteMetadata?.importedCss ?? []);
    });

  // Generate and write the final HTML content
  writeFileSync(
    htmlFile,
    indexHtml
      .replace(
        '<!-- app-head -->',
        `${importedCss
          .map((cssLink) => {
            return `<link rel="stylesheet" href="${cssLink}">`;
          })
          .join('\n')}
        <title>${title}</title>`
      )
      .replace('<!-- app-content -->', pageContent)
  );
}
