#!/usr/bin/env node
/// <reference types="node" />

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import semver from 'semver';
import { createPromptModule } from 'inquirer';
import process from 'node:process';

// Configuration
const CONFIG = {
  minNodeVersion: '14.0.0',
  directories: ['public', 'public/icons', 'source', 'source/styles'],
  dependencies: {
    '@adbl/dom': 'latest',
  },
  devDependencies: {
    vite: '^5.4.1',
    typescript: '^5.5.2',
    tailwindcss: '^3.4.10',
    autoprefixer: '^10.4.20',
    postcss: '^8.4.4',
    sass: '^1.72.0',
  },
};

const args = process.argv.slice(2);

/** @type {any} */
const questions = [
  {
    type: 'input',
    name: 'projectName',
    message: chalk.magenta('What is the name of your project?'),
    default: 'my-grenade-app',
    validate: (input) =>
      /^[a-z0-9-]+$/.test(input) ||
      chalk.red(
        'Project name can only contain lowercase letters, numbers, and hyphens'
      ),
    when: () => args.length === 0 || args.every((arg) => arg.startsWith('-')), // Only ask if not provided as an argument
  },
  {
    type: 'confirm',
    name: 'useTailwind',
    message: chalk.magenta('Do you want to use Tailwind CSS?'),
    default: true,
  },
  {
    type: 'list',
    name: 'cssPreprocessor',
    message: chalk.magenta('Which styling language would you like to use?'),
    choices: ['SCSS', 'CSS'],
    default: 'SCSS',
  },
  {
    type: 'list',
    name: 'language',
    message: chalk.magenta('Which language would you like to use?'),
    choices: ['TypeScript', 'JavaScript'],
    default: 'TypeScript',
  },
  {
    type: 'confirm',
    name: 'useRouter',
    message: chalk.magenta('Do you want to use a router?'),
    default: true,
  },
  {
    type: 'confirm',
    name: 'useCells',
    message: chalk.green('Add @adbl/cells for fine-grained reactivity? ✨'),
    default: true,
  },
];

async function main() {
  let projectDir;
  try {
    checkNodeVersion();

    // Get project name from command line argument or prompt
    const projectName = args.find((arg) => !arg.startsWith('-'));

    /** @type {Record<string, any>} */
    const answers = {};
    const questionsToAsk = questions;

    if (projectName) {
      // If project name is provided as an argument, skip the project name question
      console.log(chalk.cyan(`Using project name: ${projectName}`));
      answers.projectName = projectName;
    }

    // Create a custom prompt module that suppresses output
    const prompt = createPromptModule({ output: process.stdout });
    // Use the custom prompt for all questions
    for (const [key, value] of Object.entries(await prompt(questionsToAsk))) {
      answers[key] = value;
    }

    projectDir = path.join(process.cwd(), answers.projectName);

    const spinner = ora({
      text: 'Creating project structure...',
      spinner: 'aesthetic',
      color: 'cyan',
    }).start();

    await createProjectStructure(projectDir, answers);
    await initializeGit(projectDir);

    spinner.succeed(
      chalk.green(`Project ${answers.projectName} created successfully!`)
    );

    displayCompletionMessage(answers.projectName);
  } catch (error) {
    if (error.isTtyError) {
      console.error(
        chalk.red("Prompt couldn't be rendered in the current environment")
      );
    } else if (error.name === 'UserQuitError') {
      console.log(chalk.yellow('\nProject creation cancelled.'));
    } else {
      console.error(chalk.red('An error occurred:'), error);
    }
    await cleanupProject(projectDir);
  }
}

function checkNodeVersion() {
  const currentVersion = process.version;
  if (semver.lt(currentVersion, CONFIG.minNodeVersion)) {
    throw new Error(
      `Node.js version ${CONFIG.minNodeVersion} or higher is required. Current version: ${currentVersion}`
    );
  }
}

async function createProjectStructure(projectDir, answers) {
  await fs.mkdir(projectDir, { recursive: true });

  for (const dir of CONFIG.directories) {
    await fs.mkdir(path.join(projectDir, dir), { recursive: true });
  }

  if (answers.useRouter) {
    await fs.mkdir(path.join(projectDir, 'source/pages'), { recursive: true });
  }

  await Promise.all([
    createIcon(projectDir),
    createIndexHtml(projectDir, answers),
    createViteConfig(projectDir, answers),
    createStyleFiles(projectDir, answers),
    createMainFile(projectDir, answers),
    createRouterFile(projectDir, answers),
    createPackageJson(projectDir, answers),
    createAppComponent(projectDir, answers),
    createConfigFile(projectDir, answers),
  ]);

  if (answers.useTailwind) {
    await createPostcssConfig(projectDir);
  }
}

async function initializeGit(projectDir) {
  try {
    execSync('git init', { cwd: projectDir, stdio: 'ignore' });
    await fs.writeFile(
      path.join(projectDir, '.gitignore'),
      'node_modules\ndist\n.DS_Store'
    );
  } catch (error) {
    console.warn(
      chalk.yellow(
        'Failed to initialize git repository. You can do it manually later.'
      )
    );
  }
}

async function cleanupProject(projectDir) {
  if (projectDir) {
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
      console.log(
        chalk.yellow('Cleaned up partially created project directory.')
      );
    } catch (error) {
      console.error(chalk.red('Failed to clean up project directory:'), error);
    }
  }
}

async function createIndexHtml(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const styleExtension = answers.cssPreprocessor === 'SCSS' ? 'scss' : 'css';
  const content = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Grenade API app</title>
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <link rel="stylesheet" href="/source/styles/base.${styleExtension}">
  </head>
  <body>
    <div id="app">
    </div>
    <script type="module" src="/source/main.${extension}"></script>
  </body>
</html>
  `.trim();

  await fs.writeFile(path.join(projectDir, 'index.html'), content);
}

async function createIcon(projectDir) {
  const icon = `<svg width="191" height="191" viewBox="0 0 191 191" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0_7_2)">
        <g clip-path="url(#clip1_7_2)">
            <rect x="4" y="4" width="183" height="183" rx="32.1636" fill="url(#paint0_linear_7_2)" />
            <line x1="244.452" y1="12.1822" x2="17.9893" y2="238.645" stroke="white" stroke-width="14" />
            <line x1="148.412" y1="-22.2431" x2="-78.0502" y2="204.219" stroke="white" stroke-width="14" />
            <ellipse cx="31.7881" cy="167.788" rx="49.349" ry="49.3467" transform="rotate(134.826 31.7881 167.788)"
                fill="white" />
        </g>
        <rect x="9.435" y="9.435" width="172.13" height="172.13" rx="26.7286" stroke="white" stroke-width="10.87" />
    </g>
    <rect x="2" y="2" width="187" height="187" rx="34.15" stroke="#355FAC" stroke-width="4" />
    <defs>
        <linearGradient id="paint0_linear_7_2" x1="95.5" y1="4" x2="95.5" y2="187" gradientUnits="userSpaceOnUse">
            <stop stop-color="#538ACA" />
            <stop offset="1" stop-color="#04187C" />
        </linearGradient>
        <clipPath id="clip0_7_2">
            <rect x="4" y="4" width="183" height="183" rx="32.15" fill="white" />
        </clipPath>
        <clipPath id="clip1_7_2">
            <rect x="4" y="4" width="183" height="183" rx="32.1636" fill="white" />
        </clipPath>
    </defs>
</svg>`;
  await fs.writeFile(path.join(projectDir, 'public', 'logo.svg'), icon);
}

async function createViteConfig(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const content = `
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './source'),
    },
  },
  esbuild: {
    jsxFactory: '__jsx',
    jsxFragment: '__jsxFragment',
  },
});
  `.trim();

  await fs.writeFile(
    path.join(projectDir, `vite.config.${extension}`),
    content.trim()
  );
}

async function createPostcssConfig(projectDir) {
  const content = `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  await fs.writeFile(
    path.join(projectDir, 'postcss.config.js'),
    content.trim()
  );
}

async function createStyleFiles(projectDir, answers) {
  const extension = answers.cssPreprocessor === 'SCSS' ? 'scss' : 'css';

  // Create base styles file
  const baseContent = `
:root {
  --primary-color: #646cff;
  --background-color: #ffffff;
  --text-color: #000000;
  --font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
}

body {
  font-family: var(--font-family);
  line-height: 1.5;
  font-weight: 400;
  color: var(--text-color);
  background-color: var(--background-color);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

#app {
  margin: 0 auto;
  padding: 2rem;
}

a {
  color: var(--primary-color);
  text-decoration: none;
}
  `.trim();

  await fs.writeFile(
    path.join(projectDir, `source/styles/base.${extension}`),
    baseContent
  );

  if (answers.useTailwind) {
    const tailwindContent = `
@tailwind base;
@tailwind components;
@tailwind utilities;
`;

    await fs.writeFile(
      path.join(projectDir, `source/styles/tailwind.${extension}`),
      tailwindContent.trim()
    );

    const tailwindConfigContent = `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./source/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;

    await fs.writeFile(
      path.join(projectDir, 'tailwind.config.js'),
      tailwindConfigContent.trim()
    );
  }
}

/**
 * @param {string} projectDir
 * @param {{ language: string; useRouter: any; }} answers
 */
async function createMainFile(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  let content = `
/// <reference types="vite/client" />

import { defineJsxGlobals } from '@adbl/dom';
defineJsxGlobals();
`;

  if (answers.useRouter) {
    content += `
import { define } from './router';
const router = define();
document.getElementById('app')?.appendChild(router.Outlet());
      `;
  } else {
    content += `
import { App } from './App';

document.getElementById('app')?.appendChild(App());
    `;
  }

  await fs.writeFile(
    path.join(projectDir, `source/main.${extension}`),
    content.trim()
  );
}

async function createRouterFile(projectDir, answers) {
  if (!answers.useRouter) {
    return;
  }

  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const content = `
import { createWebRouter } from '@adbl/grenade';
import { homeRoutes } from './pages/home/routes';

export function define() {
  const routes = [
    {
      name: 'App',
      path: '/',
      redirect: '/home',
      children: [
        ...homeRoutes,
      ],
    },
  ];
  return createWebRouter({ routes });
}
  `.trim();

  await fs.writeFile(
    path.join(projectDir, `source/router.${extension}`),
    content
  );

  // Create home view structure
  await createViewStructure(projectDir, 'home', answers);
}

async function createViewStructure(projectDir, viewName, answers) {
  await createComponentStructure(projectDir, viewName, true, answers);
}

async function createAppComponent(projectDir, answers) {
  if (answers.useRouter) return; // Only create App component if not using router
  await createComponentStructure(projectDir, 'App', false, answers);
}

async function createComponentStructure(
  projectDir,
  componentName,
  isView,
  answers
) {
  const extension = answers.language === 'TypeScript' ? 'tsx' : 'jsx';
  const styleExtension = answers.cssPreprocessor === 'SCSS' ? 'scss' : 'css';

  const componentDir = isView
    ? path.join(projectDir, `source/pages/${componentName}`)
    : path.join(projectDir, 'source');
  await fs.mkdir(componentDir, { recursive: true });

  const tailwind = Boolean(answers.useTailwind);
  const containerClass = `${componentName}-${isView ? 'view' : ''}`;

  const containerClasses = tailwind
    ? 'min-h-screen flex items-center justify-center'
    : containerClass;

  const mainElementClasses = tailwind
    ? 'max-w-7xl mx-auto p-8 text-center'
    : `${containerClass}__Content`;

  const headingClasses = tailwind
    ? 'text-5xl font-bold mb-4'
    : `${containerClass}__Heading`;
  const gradientClass = `${containerClass}__Gradient`;
  const paragraphClasses = tailwind ? 'mb-8' : `${containerClass}__Text`;
  const subTextClasses = tailwind
    ? 'text-gray-600'
    : `${containerClass}__ReadTheDocs`;

  const imageElementClasses = tailwind
    ? 'mb-4 mx-auto'
    : `${containerClass}__Image`;

  const textContent = isView
    ? `You're viewing the ${capitalizeFirstLetter(componentName)} page`
    : "You're all set to start building amazing things!";

  const linkClasses = tailwind ? 'text-blue-600' : `${containerClass}__Link`;
  const linkSuffix = isView ? 'to learn more' : 'to get started.';

  const content = `
export ${isView ? 'default' : ''} function ${componentName}() {
  return (
    <div class="${containerClasses}">
      <main class="${mainElementClasses}">
        <img src="/logo.svg" alt="Logo" class="${imageElementClasses}" />
        <h1 class="${headingClasses}">
          <span class="${gradientClass}">dom.</span>
        </h1>
        <p class="${paragraphClasses}>${textContent}</p>
        <p class="${subTextClasses}">
          Check out the
          <a
            href="https://github.com/adebola-io/dom"
            target="_blank" rel="noopener noreferrer"
            class="${linkClasses}"
          >
            documentation
          </a> ${linkSuffix}
        </p>
      </main>
    </div>
  )
}
  `;

  await fs.writeFile(
    path.join(componentDir, `${isView ? 'index' : componentName}.${extension}`),
    content
  );

  if (!tailwind) {
    const stylesContent = `
.${containerClass} {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;

  .${containerClass}__Content {
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  .${containerClass}__Image {
    margin-bottom: 1rem;
    margin-inline: auto;
  }

  .${containerClass}__Heading {
    font-size: 3.2em;
    line-height: 1.1;
    margin-bottom: 1rem;
  }
     
  ${containerClass}__Gradient {
    display: inline-block;
    background: linear-gradient(to bottom right, #000000 60%, #000033 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .${containerClass}__Text {
    color: #888;
  }

  .${containerClass}__ReadTheDocs {
    color: #888;
  }

  .${containerClass}__Link {
    color: #646cff;
    text-decoration: inherit;
  }
}
`;

    await fs.writeFile(
      path.join(
        componentDir,
        `${isView ? 'styles' : componentName}.${styleExtension}`
      ),
      stylesContent
    );
  }

  if (isView) {
    const routesContent = `
import { defineRoutes, lazy } from '@adbl/dom';

export const ${componentName}Routes = defineRoutes([
  {
    name: '${capitalizeFirstLetter(componentName)} View',
    path: '/${componentName}',
    component: lazy(() => import('./index')),
  },
]);
  `.trim();

    const extensionBase = answers.language === 'TypeScript' ? 'ts' : 'js';
    await fs.writeFile(
      path.join(componentDir, `routes.${extensionBase}`),
      routesContent
    );
  }
}

async function createPackageJson(projectDir, answers) {
  const content = {
    name: answers.projectName,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      ...CONFIG.dependencies,
    },
    devDependencies: {
      vite: CONFIG.devDependencies.vite,
    },
  };

  if (answers.useCells) {
    content.dependencies['@adbl/cells'] = 'latest';
  }

  if (answers.language === 'TypeScript') {
    content.devDependencies.typescript = CONFIG.devDependencies.typescript;
  }

  if (answers.useTailwind) {
    content.devDependencies.tailwindcss = CONFIG.devDependencies.tailwindcss;
    content.devDependencies.autoprefixer = CONFIG.devDependencies.autoprefixer;
    content.devDependencies.postcss = CONFIG.devDependencies.postcss;
  }

  if (answers.cssPreprocessor === 'SCSS') {
    content.devDependencies.sass = CONFIG.devDependencies.sass;
  }

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(content, null, 2)
  );
}

async function createConfigFile(projectDir, answers) {
  const isTypeScript = answers.language === 'TypeScript';
  const fileName = isTypeScript ? 'tsconfig.json' : 'jsconfig.json';
  const content = {
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
      jsx: 'preserve',
      types: ['@adbl/dom/library/jsx-runtime'],
      baseUrl: '.',
      paths: {
        '@/*': ['./source/*'],
      },
    },
    include: ['source'],
  };

  if (isTypeScript) {
    content.compilerOptions.skipLibCheck = true;
  }

  await fs.writeFile(
    path.join(projectDir, fileName),
    JSON.stringify(content, null, 2)
  );
}

function cleanup() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.removeAllListeners('keypress');
  process.stdout.removeAllListeners('resize');
  process.removeAllListeners('SIGINT');
}

function displayCompletionMessage(projectName) {
  console.log(chalk.green('\n✨ Your project is ready! ✨'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(chalk.cyan('1. Navigate to your project folder:'));
  console.log(chalk.white(`   cd ${projectName}`));
  console.log(chalk.cyan('2. Install project dependencies:'));
  console.log(chalk.white('   npm install'));
  console.log(chalk.cyan('3. Start the development server:'));
  console.log(chalk.white('   npm run dev'));
  console.log(chalk.cyan('4. Open your browser and visit:'));
  console.log(chalk.white('   http://localhost:5173'));
  console.log(
    chalk.cyan(`5. Begin editing your project files in the 'source' directory`)
  );
  console.log(chalk.cyan('6. To build for production, run:'));
  console.log(chalk.white('   npm run build'));
  console.log(chalk.blue('\nHappy coding! 🚀'));
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

main().catch(() => process.exit(1));
