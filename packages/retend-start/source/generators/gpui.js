import fs from 'node:fs/promises';
import path from 'node:path';

import { CONFIG, isBun } from '../runtime.js';
import {
  createDocsFiles,
  createProjectDirs,
  createTsConfig,
  createVSCodeFolder,
  createZedFolder,
  writeJsonFile,
} from './shared.js';

/**
 * @typedef {Record<string, any>} Answers
 * @typedef {Record<string, any>} CliOptions
 */

const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 840;

/**
 * @param {string} projectName
 * @returns {string}
 */
function toDisplayName(projectName) {
  return projectName
    .split(/[-_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @param {CliOptions} cliOptions
 * @returns {Promise<void>}
 */
export async function createGpuiProject(projectDir, answers, cliOptions) {
  await createProjectDirs(projectDir, ['source']);

  await Promise.all([
    createApplicationFile(projectDir, answers),
    createMainFile(projectDir, answers),
    createRouterFile(projectDir, answers),
    createViteConfig(projectDir, answers),
    createViteEnvDeclaration(projectDir),
    createPackageJson(projectDir, answers, cliOptions),
    createTsConfig(projectDir, answers, {
      jsxImportSource: 'retend',
      types: ['retend-gpui/jsx-runtime', 'retend-gpui-app'],
    }),
    createVSCodeFolder(projectDir, {
      language: answers.language,
      styleSupport: null,
    }),
    createZedFolder(projectDir),
    createDocsFiles(projectDir, Boolean(answers.includeDocs)),
  ]);
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createApplicationFile(projectDir, answers) {
  const isTypeScript = answers.language === 'TypeScript';
  const extension = isTypeScript ? 'ts' : 'js';
  const content = isTypeScript
    ? `
import type { GpuiApplication } from 'retend-gpui';

interface ApplicationContext {
  startedAt: Date;
}

export default class Application implements GpuiApplication<ApplicationContext> {
  readonly context: ApplicationContext = {
    startedAt: new Date(),
  };

  init(): void {}

  cleanup(): void {}
}
`.trim()
    : `
export default class Application {
  context = {
    startedAt: new Date(),
  };

  init() {}

  cleanup() {}
}
`.trim();

  await fs.writeFile(
    path.join(projectDir, `source/application.${extension}`),
    content
  );
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createMainFile(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'tsx' : 'jsx';
  const content = `
import Root from './router';

export default Root;
`.trim();

  await fs.writeFile(
    path.join(projectDir, `source/main.${extension}`),
    content
  );
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createRouterFile(projectDir, answers) {
  const isTypeScript = answers.language === 'TypeScript';
  const extension = isTypeScript ? 'tsx' : 'jsx';
  const content = isTypeScript
    ? `
import { onSetup } from 'retend';
import { useWindow } from 'retend-gpui';
import { Outlet, Router, RouterProvider } from 'retend/router';

import App from './App';

const routes = [{ path: '/', component: App }];

export default function Root() {
  const window = useWindow();
  const router = new Router({ routes, linkTag: 'div' });

  onSetup(() => {
    const host = window.host as unknown as Window;
    const detach = router.attachWindowListeners(host);
    window.host.dispatchEvent(new Event('load'));
    return detach;
  });

  return (
    <RouterProvider router={router}>
      <Outlet />
    </RouterProvider>
  );
}
`.trim()
    : `
import { onSetup } from 'retend';
import { useWindow } from 'retend-gpui';
import { Outlet, Router, RouterProvider } from 'retend/router';

import App from './App';

const routes = [{ path: '/', component: App }];

export default function Root() {
  const window = useWindow();
  const router = new Router({ routes, linkTag: 'div' });

  onSetup(() => {
    const detach = router.attachWindowListeners(window.host);
    window.host.dispatchEvent(new Event('load'));
    return detach;
  });

  return (
    <RouterProvider router={router}>
      <Outlet />
    </RouterProvider>
  );
}
`.trim();

  await fs.writeFile(
    path.join(projectDir, `source/router.${extension}`),
    content
  );

  await createCounterApp(projectDir, answers);
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createCounterApp(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'tsx' : 'jsx';
  const content = `
import { Cell } from 'retend';

export default function App() {
  const count = Cell.source(0);
  const incrementCount = () => count.set(count.get() + 1);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: 28 }}>${toDisplayName(answers.projectName)}</div>
      <div>Welcome to your new Retend desktop app!</div>
      <button type="button" onClick={incrementCount}>
        Counter: {count}
      </button>
    </div>
  );
}
`.trim();

  await fs.writeFile(path.join(projectDir, `source/App.${extension}`), content);
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createViteConfig(projectDir, answers) {
  const isTypeScript = answers.language === 'TypeScript';
  const extension = isTypeScript ? 'ts' : 'js';
  const displayName = toDisplayName(answers.projectName);
  const content = `
import { retendGpui } from 'retend-gpui/plugins/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  plugins: [
    retendGpui({
      app: {
        name: '${displayName}',
        identifier: 'dev.retend.${answers.projectName}',
        version: '0.0.0',
      },
      application: './source/application.${isTypeScript ? 'ts' : 'js'}',
      entry: './source/main.${isTypeScript ? 'tsx' : 'jsx'}',
      window: {
        title: '${displayName}',
        width: ${DEFAULT_WINDOW_WIDTH},
        height: ${DEFAULT_WINDOW_HEIGHT},
      },
    }),
  ],
});
`.trim();

  await fs.writeFile(
    path.join(projectDir, `vite.config.${extension}`),
    content
  );
}

/**
 * @param {string} projectDir
 * @returns {Promise<void>}
 */
async function createViteEnvDeclaration(projectDir) {
  const content = '/// <reference types="vite/client" />\n';

  await fs.writeFile(path.join(projectDir, 'source/vite-env.d.ts'), content);
}

/**
 * @param {string | undefined} commitHash
 * @returns {Record<string, string>}
 */
function getRetendDependencies(commitHash) {
  if (commitHash) {
    return {
      retend: `https://pkg.pr.new/resuite/retend@${commitHash}`,
      'retend-gpui': `https://pkg.pr.new/resuite/retend/retend-gpui@${commitHash}`,
    };
  }

  return {
    retend: CONFIG.dependencies.retend,
    'retend-gpui': CONFIG.dependencies['retend-gpui'],
  };
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @param {CliOptions} cliOptions
 * @returns {Promise<void>}
 */
async function createPackageJson(projectDir, answers, cliOptions) {
  const content = {
    name: answers.projectName,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'retend-gpui dev',
      build: 'vite build',
      typecheck: 'tsc --noEmit',
      lint: 'oxlint .',
    },
    dependencies: getRetendDependencies(cliOptions.commit),
    /** @type {Record<string, string>} */
    devDependencies: {
      vite: CONFIG.devDependencies.vite,
      oxfmt: CONFIG.devDependencies.oxfmt,
      oxlint: CONFIG.devDependencies.oxlint,
      'retend-oxlint-plugin': CONFIG.devDependencies['retend-oxlint-plugin'],
    },
  };

  if (answers.language === 'TypeScript') {
    content.devDependencies.typescript = CONFIG.devDependencies.typescript;
    content.devDependencies[isBun ? '@types/bun' : '@types/node'] = 'latest';
  }

  await writeJsonFile(projectDir, 'package.json', content);
}
