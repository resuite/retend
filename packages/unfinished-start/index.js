#!/usr/bin/env node
/// <reference types="node" />

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import process from 'node:process';
import path from 'node:path';

import chalk from 'chalk';
import ora from 'ora';
import semver from 'semver';
import { createPromptModule } from 'inquirer';

// Configuration
const CONFIG = {
  minNodeVersion: '14.0.0',
  directories: ['public', 'public/icons', 'source', 'source/styles'],
  dependencies: {
    '@adbl/unfinished': '^0.0.16',
    '@adbl/cells': '^0.0.11',
    '@adbl/unfinished-ssg': '^0.0.4',
  },
  devDependencies: {
    vite: '^6.2.1',
    typescript: '^5.5.2',
    tailwindcss: '^3.4.10',
    autoprefixer: '^10.4.20',
    postcss: '^8.4.4',
    sass: '^1.72.0',
  },
};

const isBun =
  typeof process !== 'undefined' && process.versions && process.versions.bun;

const args = process.argv.slice(2);

/**
 * Parse command line arguments into options
 * @returns {Record<string, any>}
 */
function parseArgs() {
  /** @type {Record<string, any>} */
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value || true;
    }
  }
  return options;
}

// Update questions array to include property for matching command line args
/** @type {any} */
const questions = [
  {
    type: 'input',
    name: 'projectName',
    message: chalk.magenta('What is the name of your project?'),
    default: 'my-app',
    argKey: 'name',
    validate: (/** @type {string} */ input) =>
      /^[a-z0-9-]+$/.test(input) ||
      chalk.red(
        'Project name can only contain lowercase letters, numbers, and hyphens'
      ),
  },
  {
    type: 'confirm',
    name: 'useTailwind',
    message: chalk.magenta('Do you want to use Tailwind CSS?'),
    default: false,
    argKey: 'tailwind',
  },
  {
    type: 'list',
    name: 'cssPreprocessor',
    message: chalk.magenta('Which styling language would you like to use?'),
    choices: ['SCSS', 'CSS'],
    default: 'CSS',
    argKey: 'scss',
    /** @param {string} value */
    processArg: (value) => (value ? 'SCSS' : 'CSS'),
  },
  {
    type: 'list',
    name: 'language',
    message: chalk.magenta('Which language would you like to use?'),
    choices: ['TypeScript', 'JavaScript'],
    default: 'JavaScript',
    argKey: 'javascript',
    /** @param {string} value */
    processArg: (value) => (value ? 'JavaScript' : 'TypeScript'),
  },
  {
    type: 'confirm',
    name: 'useSSG',
    message: chalk.magenta('Do you want to use Static Site Generation (SSG)?'),
    default: false,
    argKey: 'ssg',
    /** @param {string} value */
  },
];

/**
 * Main function to create a new project
 */
async function main() {
  let projectDir;
  try {
    checkNodeVersion();

    const cliOptions = parseArgs();
    /** @type {Record<string, any>} */
    const answers = {};

    // Handle default flag
    if (cliOptions.default) {
      // Get answers from CLI options first for explicitly set options
      for (const q of questions) {
        if (q.argKey && q.argKey in cliOptions) {
          const value = cliOptions[q.argKey];
          answers[q.name] = q.processArg ? q.processArg(value) : value;
        } else {
          // Use default values for unspecified options
          answers[q.name] = q.default;
        }
      }

      // Handle project name separately
      const projectName = args.find((arg) => !arg.startsWith('-'));
      answers.projectName = projectName || 'my-app';
    } else {
      // Original logic for non-default mode
      let questionsToAsk = questions.filter(
        (
          /** @type {{ argKey: string; name: string | number; processArg: (arg0: any) => any; }} */ q
        ) => {
          if (q.argKey && q.argKey in cliOptions) {
            const value = cliOptions[q.argKey];
            answers[q.name] = q.processArg ? q.processArg(value) : value;
            return false;
          }
          return true;
        }
      );

      // Get project name from positional argument if provided
      const projectName = args.find((arg) => !arg.startsWith('-'));
      if (projectName) {
        answers.projectName = projectName;
        questionsToAsk = questionsToAsk.filter(
          (/** @type {{ name: string; }} */ q) => q.name !== 'projectName'
        );
      }

      // Only prompt for remaining questions if any
      if (questionsToAsk.length > 0) {
        const prompt = createPromptModule({ output: process.stdout });
        const promptAnswers = await prompt(questionsToAsk);
        Object.assign(answers, promptAnswers);
      }
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
    process.exit(0);
  } catch (/** @type {any} */ error) {
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

function generateLightColor() {
  // Generate high values for RGB to ensure light colors
  const r = Math.floor(Math.random() * 56) + 200; // 200-255
  const g = Math.floor(Math.random() * 56) + 200; // 200-255
  const b = Math.floor(Math.random() * 56) + 200; // 200-255

  return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}

/**
 * Function to check the current Node.js version
 */
function checkNodeVersion() {
  const currentVersion = process.version;
  if (semver.lt(currentVersion, CONFIG.minNodeVersion)) {
    throw new Error(
      `Node.js version ${CONFIG.minNodeVersion} or higher is required. Current version: ${currentVersion}`
    );
  }
}

/**
 * Function to create the project structure
 * @param {string} projectDir - The directory where the project will be created
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
async function createProjectStructure(projectDir, answers) {
  await fs.mkdir(projectDir, { recursive: true });

  for (const dir of CONFIG.directories) {
    await fs.mkdir(path.join(projectDir, dir), { recursive: true });
  }

  await fs.mkdir(path.join(projectDir, 'source/views'), { recursive: true });

  await Promise.all([
    createIndexHtml(projectDir, answers),
    createViteConfig(projectDir, answers),
    createStyleFiles(projectDir, answers),
    createMainFile(projectDir, answers),
    createRouterFile(projectDir, answers),
    createPackageJson(projectDir, answers),
    createConfigFile(projectDir, answers),
    createVSCodeFolder(projectDir, answers),
  ]);

  if (answers.useTailwind) {
    await createPostcssConfig(projectDir);
  }
}

/**
 * Function to initialize a Git repository in the project directory
 * @param {string} projectDir - The directory where the project is created
 */
async function initializeGit(projectDir) {
  try {
    execSync('git init', { cwd: projectDir, stdio: 'ignore' });
    await fs.writeFile(
      path.join(projectDir, '.gitignore'),
      'node_modules\ndist\n.DS_Store'
    );
  } catch (error) {
    console.error(error);
    console.warn(
      chalk.yellow(
        'Failed to initialize git repository. You can do it manually later.'
      )
    );
  }
}

/**
 * Function to clean up the project directory in case of an error
 * @param {string} [projectDir] - The directory where the project is created
 */
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

/**
 * Function to create the index.html file
 * @param {string} projectDir - The directory where the project is created
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
async function createIndexHtml(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const styleExtension = answers.cssPreprocessor === 'SCSS' ? 'scss' : 'css';
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
 * Function to create the Vite configuration file
 * @param {string} projectDir - The directory where the project is created
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
async function createViteConfig(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const content = `
import { defineConfig } from 'vite';
import path from 'node:path';
import { unfinished } from '@adbl/unfinished/plugin';${
    answers.useSSG
      ? "\nimport { unfinishedSSG } from '@adbl/unfinished-ssg/plugin';"
      : ''
  }

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './source') }
  },
  plugins: [
    unfinished(),
    ${
      answers.useSSG
        ? `unfinishedSSG({
      pages: ['/'],
      routerModulePath: './source/router.${extension}'
    }),`
        : ''
    }
  ],
${
  answers.cssPreprocessor === 'SCSS'
    ? `
  css: {
    preprocessorOptions: {
      scss: {
         api: 'modern-compiler',
      },
    }
  },`
    : ''
}
});`.trim();

  await fs.writeFile(
    path.join(projectDir, `vite.config.${extension}`),
    content
  );
}

/**
 * Function to create the PostCSS configuration file
 * @param {string} projectDir - The directory where the project is created
 */
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

/**
 * Function to create the base styles and Tailwind CSS files
 * @param {string} projectDir - The directory where the project is created
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
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
 * Function to create the main file
 * @param {string} projectDir - The directory where the project is created
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
async function createMainFile(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const content = answers.useSSG
    ? `
/// <reference types="vite/client" />
import { hydrate } from '@adbl/unfinished-ssg/client';
import { createRouter } from './router';

hydrate(createRouter)
  .then(() => {
    console.log('[unfinished-ssg] app successfully hydrated.');
  });
`
    : `
/// <reference types="vite/client" />
import { createRouter } from './router';

const router = createRouter();
router.window = window;
router.attachWindowListeners();

const root = window.document.getElementById('app');
root?.append(${
        extension === 'ts'
          ? 'router.Outlet() as Node'
          : '/** @type {Node} */ (router.Outlet())'
      });
`;

  await fs.writeFile(
    path.join(projectDir, `source/main.${extension}`),
    content.trim()
  );
}

/**
 * Function to create the router file
 * @param {string} projectDir - The directory where the project is created
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
async function createRouterFile(projectDir, answers) {
  const extension = answers.language === 'TypeScript' ? 'ts' : 'js';
  const content = `
import { createWebRouter } from '@adbl/unfinished/router';
import { startRoute } from './views/start/routes';

export function createRouter() {
  const routes = [
    {
      name: 'App',
      path: '/',
      children: [startRoute],
    },
  ];
  return createWebRouter({ routes });
}
  `.trim();

  await fs.writeFile(
    path.join(projectDir, `source/router.${extension}`),
    content
  );

  // Create start view structure
  await createViewStructure(projectDir, 'start', answers);
}

/**
 * Function to create the view structure
 * @param {string} projectDir - The directory where the project is created
 * @param {string} viewName - The name of the view
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
async function createViewStructure(projectDir, viewName, answers) {
  await createComponentStructure(projectDir, viewName, true, answers);
}

/**
 * Function to create the component structure
 * @param {string} projectDir - The directory where the project is created
 * @param {string} componentName - The name of the component
 * @param {boolean} isView - Whether the component is a view
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
async function createComponentStructure(
  projectDir,
  componentName,
  isView,
  answers
) {
  const extension = answers.language === 'TypeScript' ? 'tsx' : 'jsx';
  const styleExtension = answers.cssPreprocessor === 'SCSS' ? 'scss' : 'css';

  const componentDir = isView
    ? path.join(projectDir, `source/views/${componentName}`)
    : path.join(projectDir, 'source');
  await fs.mkdir(componentDir, { recursive: true });

  const tailwind = Boolean(answers.useTailwind);
  const containerClass = `${componentName}${isView ? 'View' : ''}`;

  const containerClasses = tailwind
    ? `"min-h-screen flex items-center justify-center bg-gradient-to-r from-[${generateLightColor()}] to-[${generateLightColor()}]"`
    : `{classes.${containerClass}}`;

  const mainElementClasses = tailwind
    ? '"max-w-7xl mx-auto p-8 text-center"'
    : '{classes.content}';

  const headingClasses = tailwind
    ? '"text-5xl font-bold mb-4"'
    : '{classes.heading}';

  const textClass = tailwind ? '"inline-block"' : '{classes.headingText}';

  const paragraphClasses = tailwind ? '"mb-4"' : '{classes.paragraph}';
  const subTextClasses = tailwind ? '"text-gray-600"' : '{classes.readTheDocs}';

  const textContent = "You're all set to start building amazing things!";

  const buttonClasses = tailwind
    ? '"font-[inherit] bg-white border-2 mt-4 border-gray-300 rounded-[7px] px-[15px] py-[10px]"'
    : '{classes.button}';

  const linkClasses = tailwind ? '"text-blue-600"' : '{classes.link}';
  const linkSuffix = isView ? 'to learn more.' : 'to get started.';
  const cssImport = tailwind
    ? ''
    : `import classes from './${
        isView ? 'styles' : componentName
      }.module.${styleExtension}';\n`;

  const content = `import { Cell } from '@adbl/cells';${
    cssImport ? `\n${cssImport}` : ''
  }

export ${isView ? 'default' : ''} function ${capitalize(componentName)}() {
  const count = Cell.source(0);
  const incrementCount = () => count.value++;

  return (
    <div class=${containerClasses}>
      <main class=${mainElementClasses}>
        <h1 class=${headingClasses}>
          <span class=${textClass}>${answers.projectName}.</span>
        </h1>
        <p class=${paragraphClasses}>${textContent}</p>
        <p class=${subTextClasses}>
          Check out the{' '}
          <a
            href="https://github.com/adebola-io/unfinished"
            target="_blank" rel="noopener noreferrer"
            class=${linkClasses}
          >
            documentation
          </a> ${linkSuffix}
        </p>
        <button class=${buttonClasses} type="button" onClick={incrementCount}>
          Counter Value: {count}
        </button>
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
    const stylesContent = `.${containerClass} {
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
}

.headingText {
  display: inline-block;
}

.readTheDocs {
  color: #888;
}

.paragraph {
  margin-block-end: 1rem;
}

.link {
  color: #646cff;
  text-decoration: inherit;
}

.button {
  font: inherit;
  background-color: white;
  border-radius: 7px;
  padding: 10px 15px;
  border: 2px solid gray;
  margin-top: 4px;
}
`;

    await fs.writeFile(
      path.join(
        componentDir,
        `${isView ? 'styles' : componentName}.module.${styleExtension}`
      ),
      stylesContent
    );
  }

  if (isView) {
    const routesContent = `
import { defineRoute } from '@adbl/unfinished/router';
import ${capitalize(componentName)} from '.';

export const ${componentName}Route = defineRoute({
  name: '${capitalize(componentName)} View',
  path: '/',
  component: ${capitalize(componentName)},
});
  `.trim();

    const extensionBase = answers.language === 'TypeScript' ? 'ts' : 'js';
    await fs.writeFile(
      path.join(componentDir, `routes.${extensionBase}`),
      routesContent
    );
  }
}

/**
 * @param {string} projectDir
 * @param {Record<string, unknown>} answers
 */
async function createPackageJson(projectDir, answers) {
  if (!answers.useSSG) {
    Reflect.deleteProperty(CONFIG.dependencies, '@adbl/unfinished-ssg');
  }

  const content = {
    name: answers.projectName,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite --port 5229',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      ...CONFIG.dependencies,
    },
    /** @type {Record<string, string>} */
    devDependencies: {
      vite: CONFIG.devDependencies.vite,
    },
  };

  if (answers.language === 'TypeScript') {
    content.devDependencies.typescript = CONFIG.devDependencies.typescript;
    // Add the appropriate types based on runtime
    content.devDependencies[isBun ? '@types/bun' : '@types/node'] = 'latest';
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

/**
 * @param {string} projectDir
 * @param {Record<string, unknown>} answers
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
      jsxImportSource: '@adbl/unfinished',
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

/**
 * Function to create the .vscode folder with extension recommendations
 * @param {string} projectDir - The directory where the project is created
 * @param {Record<string, any>} answers - The answers to the project creation questions
 */
async function createVSCodeFolder(projectDir, answers) {
  const vscodeDir = path.join(projectDir, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });

  const extensions = ['biomejs.biome', 'esbenp.prettier-vscode'];

  if (answers.language === 'TypeScript') {
    extensions.push('ms-vscode.vscode-typescript-next');
  }

  if (answers.useTailwind) {
    extensions.push('bradlc.vscode-tailwindcss');
  } else {
    extensions.push('clinyong.vscode-css-modules', '1yasa.css-better-sorting');
  }

  if (answers.cssPreprocessor === 'SCSS') {
    extensions.push('syler.sass-indented');
  }

  const extensionsContent = {
    recommendations: extensions,
  };

  await fs.writeFile(
    path.join(vscodeDir, 'extensions.json'),
    JSON.stringify(extensionsContent, null, 2)
  );
}

/**
 * @param {string} projectName
 */
function displayCompletionMessage(projectName) {
  console.log(chalk.green('\n✨ Your project is ready! ✨'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(chalk.cyan('1. Navigate to your project folder:'));
  console.log(chalk.white(`   cd ${projectName}`));
  console.log(chalk.cyan('2. Install project dependencies:'));
  console.log(chalk.white(`   ${isBun ? 'bun install' : 'npm install'}`));
  console.log(chalk.cyan('3. Start the development server:'));
  console.log(chalk.white(`   ${isBun ? 'bun run dev' : 'npm run dev'}`));
  console.log(chalk.cyan('4. Open your browser and visit:'));
  console.log(chalk.white('   http://localhost:5529'));
  console.log(
    chalk.cyan(`5. Begin editing your project files in the 'source' directory`)
  );
  console.log(chalk.cyan('6. To build for production, run:'));
  console.log(chalk.white(`${isBun ? 'bun run build' : 'npm run build'}`));
  console.log(chalk.blue('\nHappy coding! 🚀'));
}

/**
 * @param {string} string
 */
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

main().catch(() => process.exit(1));
