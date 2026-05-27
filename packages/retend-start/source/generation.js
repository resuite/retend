import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';

import { CONFIG, isBun } from './runtime.js';

/**
 * @typedef {Record<string, any>} Answers
 * @typedef {Record<string, any>} CliOptions
 */

/**
 * @returns {string}
 */
function generateLightColor() {
  const r = Math.floor(Math.random() * 56) + 200;
  const g = Math.floor(Math.random() * 56) + 200;
  const b = Math.floor(Math.random() * 56) + 200;

  return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @param {CliOptions} cliOptions
 * @returns {Promise<void>}
 */
export async function createProjectStructure(projectDir, answers, cliOptions) {
  await fs.mkdir(projectDir, { recursive: true });

  for (const dir of CONFIG.directories) {
    await fs.mkdir(path.join(projectDir, dir), { recursive: true });
  }

  await Promise.all([
    createIndexHtml(projectDir, answers),
    createViteConfig(projectDir, answers),
    createStyleFiles(projectDir, answers),
    createMainFile(projectDir, answers),
    createRouterFile(projectDir, answers),
    createPackageJson(projectDir, answers, cliOptions),
    createConfigFile(projectDir, answers),
    createVSCodeFolder(projectDir, answers),
    createZedFolder(projectDir),
    createDocsFiles(projectDir, answers),
  ]);
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createIndexHtml(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'tsx' : 'jsx';
  const styleExtension = 'css';
  const content = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${answers.projectName}</title>
    <link rel="stylesheet" href="./source/styles/base.${styleExtension}">
    ${
      answers.useTailwind
        ? `<link rel="stylesheet" href="./source/styles/tailwind.${styleExtension}">`
        : ''
    }
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./source/main.${extension}"></script>
  </body>
</html>
  `.trim();

  await fs.writeFile(path.join(projectDir, 'index.html'), content);
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createViteConfig(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const content = `
import { defineConfig } from 'vite';
import path from 'node:path';
import { retend } from 'retend-web/plugins/vite';${
    answers.useSSG ? "\nimport { retendSSG } from 'retend-server/plugin';" : ''
  }${
    answers.useTailwind ? "\nimport tailwindcss from '@tailwindcss/vite';" : ''
  }

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') }
  },
  plugins: [${answers.useTailwind ? 'tailwindcss(),' : ''}
    retend(),
    ${
      answers.useSSG
        ? `retendSSG({
      pages: ['/'],
      routerModulePath: './source/router.${extension}'
    }),`
        : ''
    }
   ],
 });`.trim();

  await fs.writeFile(
    path.join(projectDir, `vite.config.${extension}`),
    content
  );
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createStyleFiles(projectDir, answers) {
  const extension = 'css';
  const baseContent = `
:root {
  --primary-color: #646cff;
  --background-color: #ffffff;
  --text-color: #000000;
  --font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
}

body {
  line-height: 1.5;
  margin: 0;
  color: var(--text-color);
  background-color: var(--background-color);
  font-family: var(--font-family);
  font-weight: 400;
  text-rendering: optimizeLegibility;
  -webkit-text-size-adjust: 100%;
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

  `.trimStart();

  await fs.writeFile(
    path.join(projectDir, `source/styles/base.${extension}`),
    baseContent
  );

  if (answers.useTailwind) {
    const tailwindContent = `
@import "tailwindcss";
`;

    await fs.writeFile(
      path.join(projectDir, `source/styles/tailwind.${extension}`),
      tailwindContent.trim()
    );
  }
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createMainFile(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'tsx' : 'jsx';
  const content = answers.useSSG
    ? `
/// <reference types="vite/client" />
/// <reference types="retend-web/jsx-runtime" />
import { hydrate } from 'retend-server/client';
import { RetendDevTools } from 'retend-web-devtools';
import { createRouter } from './router';

hydrate(createRouter, {
  wrap(root) {
    return <RetendDevTools>{root}</RetendDevTools>;
  },
})
  .then(() => {
    console.log('[retend-server] app successfully hydrated.');
  });
`
    : `
/// <reference types="vite/client" />
/// <reference types="retend-web/jsx-runtime" />
import { createRouterRoot } from 'retend/router';
import { createRouter } from './router';
import { renderToDOM } from 'retend-web';
import { RetendDevTools } from 'retend-web-devtools';

const router = createRouter();
router.attachWindowListeners(window);

const root = window.document.getElementById('app');
const renderApp = () => (
  <RetendDevTools>{createRouterRoot(router)}</RetendDevTools>
);

renderToDOM(root, renderApp);

`;

  await fs.writeFile(
    path.join(projectDir, `source/main.${extension}`),
    content.trim()
  );
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createRouterFile(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const content = `
import { Router } from 'retend/router';
import App from './App';

export function createRouter() {
  return new Router({ routes: [{ path: '/', component: App }] });
}
`.trim();

  await fs.writeFile(
    path.join(projectDir, `source/router.${extension}`),
    content
  );

  await createSimpleApp(projectDir, answers);
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createSimpleApp(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'tsx' : 'jsx';

  const tailwind = Boolean(answers.useTailwind);
  const cssImport = tailwind ? '' : `import classes from './App.module.css';\n`;

  const containerClasses = tailwind
    ? `"min-h-screen flex items-center justify-center bg-gradient-to-r from-[${generateLightColor()}] to-[${generateLightColor()}]"`
    : '{classes.app}';

  const mainElementClasses = tailwind
    ? '"max-w-7xl mx-auto p-8 text-center"'
    : '{classes.content}';

  const headingClasses = tailwind
    ? '"text-5xl font-bold mb-4 text-gray-900"'
    : '{classes.heading}';

  const textContent = 'Welcome to your new Retend app!';

  const paragraphClasses = tailwind
    ? '"mb-4 text-gray-900"'
    : '{classes.paragraph}';

  const buttonClasses = tailwind
    ? '"font-[inherit] bg-white border-2 mt-4 border-gray-300 rounded-[7px] px-[15px] py-[10px] hover:bg-gray-50 transition-colors"'
    : '{classes.button}';

  const content = `import { Cell } from 'retend';${cssImport ? `\n${cssImport}` : ''}

const App = () => {
  const count = Cell.source(0);
  const incrementCount = () => count.set(count.get() + 1);

  return (
    <div class=${containerClasses}>
      <main class=${mainElementClasses}>
        <h1 class=${headingClasses}>${answers.projectName}</h1>
        <p class=${paragraphClasses}>${textContent}</p>
        <button class=${buttonClasses} type="button" onClick={incrementCount}>
          Counter: {count}
        </button>
      </main>
    </div>
  );
};

export default App;
`;

  await fs.writeFile(path.join(projectDir, `source/App.${extension}`), content);

  if (!tailwind) {
    const stylesContent = `.app {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: linear-gradient(60deg, ${generateLightColor()}, ${generateLightColor()}, white);
}

.content {
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.heading {
  font-size: 3.2em;
  line-height: 1.1;
  margin-bottom: 1rem;
  color: #333;
}

.paragraph {
  margin-block-end: 1rem;
  color: #333;
}

.button {
  font-family: inherit;
  background-color: white;
  border: 2px solid #d1d5db;
  margin-top: 1rem;
  border-radius: 7px;
  padding: 10px 15px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.button:hover {
  background-color: #f9fafb;
}
`;

    await fs.writeFile(
      path.join(projectDir, 'source/App.module.css'),
      stylesContent
    );
  }
}

/**
 * @param {string | undefined} commitHash
 * @param {boolean} [useSSG]
 * @returns {Record<string, string>}
 */
function getRetendDependencies(commitHash, useSSG = true) {
  if (commitHash) {
    /** @type {Record<string, string>} */
    const deps = {
      retend: `https://pkg.pr.new/resuite/retend@${commitHash}`,
      'retend-utils': `https://pkg.pr.new/resuite/retend/retend-utils@${commitHash}`,
      'retend-web': `https://pkg.pr.new/resuite/retend/retend-web@${commitHash}`,
      'retend-web-devtools': `https://pkg.pr.new/resuite/retend/retend-web-devtools@${commitHash}`,
    };
    if (useSSG) {
      deps['retend-server'] =
        `https://pkg.pr.new/resuite/retend/retend-server@${commitHash}`;
    }
    return deps;
  }

  const deps = { ...CONFIG.dependencies };
  if (!useSSG) {
    Reflect.deleteProperty(deps, 'retend-server');
  }
  return deps;
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @param {CliOptions} cliOptions
 * @returns {Promise<void>}
 */
async function createPackageJson(projectDir, answers, cliOptions) {
  const commitHash = cliOptions.commit;

  const content = {
    name: answers.projectName,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite --port 5229',
      build: 'vite build',
      preview: 'vite preview',
      lint: 'oxlint .',
      format: 'oxfmt --write .',
      'format:check': 'oxfmt --check .',
    },
    dependencies: getRetendDependencies(commitHash, Boolean(answers.useSSG)),
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

  if (answers.useTailwind) {
    content.devDependencies.tailwindcss = CONFIG.devDependencies.tailwindcss;
    content.devDependencies['@tailwindcss/vite'] =
      CONFIG.devDependencies['@tailwindcss/vite'];
  }

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(content, null, 2)
  );
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createConfigFile(projectDir, answers) {
  const isTypeScript = answers.language === 'TypeScript';
  const fileName = isTypeScript ? 'tsconfig.json' : 'jsconfig.json';
  const content = {
    /** @type {Record<string, unknown>} */
    compilerOptions: {
      target: 'ESNext',
      useDefineForClassFields: true,
      module: 'ESNext',
      lib: ['ESNext', 'DOM', 'DOM.Iterable'],
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
      jsx: 'react-jsx',
      jsxImportSource: 'retend',
      types: ['retend-web/jsx-runtime'],
      paths: {
        '@/*': ['./source/*'],
      },
    },
    include: ['source'],
  };

  if (isTypeScript) {
    content.compilerOptions.skipLibCheck = true;
  }

  await Promise.all([
    fs.writeFile(
      path.join(projectDir, fileName),
      JSON.stringify(content, null, 2)
    ),
    fs.writeFile(
      path.join(projectDir, '.oxlintrc.json'),
      JSON.stringify(
        {
          $schema: './node_modules/oxlint/configuration_schema.json',
          jsPlugins: ['./node_modules/retend-oxlint-plugin/index.js'],
          rules: {
            'retend/component-statement-order': 'error',
            'retend/max-component-lines': 'error',
            'retend/max-jsx-components-per-file': 'error',
            'retend/no-classname': 'error',
            'retend/no-inline-object-type': 'error',
            'retend/no-module-cell': 'warn',
            'retend/no-module-jsx': 'error',
            'retend/no-templated-class': 'error',
            'retend/no-get-in-jsx': 'error',
            'retend/no-derived-in-jsx': 'error',
            'retend/no-get-in-derived-async': 'error',
            'retend/no-jsx-control-flow': 'error',
            'retend/no-jsx-map': 'error',
            'retend/no-listen-in-onsetup': 'error',
            'retend/no-react-imports': 'error',
            'retend/prefer-router-navigation': 'error',
            'retend/props-destructure-first': 'error',
          },
        },
        null,
        2
      )
    ),
  ]);
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createVSCodeFolder(projectDir, answers) {
  const vscodeDir = path.join(projectDir, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });

  const extensions = ['oxc.oxc-vscode'];

  if (answers.language === 'TypeScript') {
    extensions.push('ms-vscode.vscode-typescript-next');
  }

  if (answers.useTailwind) {
    extensions.push('bradlc.vscode-tailwindcss');
  } else {
    extensions.push('clinyong.vscode-css-modules');
  }

  const extensionsContent = {
    recommendations: extensions,
  };
  const settingsContent = {
    'editor.defaultFormatter': 'oxc.oxc-vscode',
    'editor.formatOnSave': false,
    'editor.codeActionsOnSave': {
      'source.format.oxc': 'always',
      'source.fixAll.oxc': 'always',
    },
  };

  await Promise.all([
    fs.writeFile(
      path.join(vscodeDir, 'extensions.json'),
      JSON.stringify(extensionsContent, null, 2)
    ),
    fs.writeFile(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settingsContent, null, 2)
    ),
  ]);
}

/**
 * @param {string} projectDir
 * @returns {Promise<void>}
 */
async function createZedFolder(projectDir) {
  const zedDir = path.join(projectDir, '.zed');
  await fs.mkdir(zedDir, { recursive: true });

  const languageSettings = {
    format_on_save: 'on',
    prettier: { allowed: false },
    formatter: [
      { language_server: { name: 'oxfmt' } },
      { code_action: 'source.fixAll.oxc' },
    ],
  };
  const settingsContent = {
    lsp: {
      oxlint: {
        initialization_options: {
          settings: { run: 'onType' },
        },
      },
      oxfmt: {
        initialization_options: {
          settings: { run: 'onSave' },
        },
      },
    },
    languages: {
      JavaScript: languageSettings,
      TypeScript: languageSettings,
      TSX: languageSettings,
    },
  };

  await fs.writeFile(
    path.join(zedDir, 'settings.json'),
    JSON.stringify(settingsContent, null, 2)
  );
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @returns {Promise<void>}
 */
async function createDocsFiles(projectDir, answers) {
  if (!answers.includeDocs) {
    return;
  }

  const packageRoot = path.dirname(
    path.dirname(new URL(import.meta.url).pathname)
  );
  const docsDir = path.join(packageRoot, 'docs', '.docs');
  const agentFile = path.join(packageRoot, 'docs', 'AGENT.md');

  try {
    await fs.cp(docsDir, path.join(projectDir, '.docs'), { recursive: true });
    await fs.cp(agentFile, path.join(projectDir, 'AGENT.md'));
  } catch {
    console.warn(
      chalk.yellow(
        'Failed to copy documentation files. You can add them manually later.'
      )
    );
  }
}
