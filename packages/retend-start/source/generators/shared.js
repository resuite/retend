import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.dirname(
  path.dirname(path.dirname(new URL(import.meta.url).pathname))
);

/**
 * @typedef {Record<string, any>} Answers
 */

/**
 * @param {string} projectDir
 * @param {Array<string>} dirs
 * @returns {Promise<void>}
 */
export async function createProjectDirs(projectDir, dirs) {
  await fs.mkdir(projectDir, { recursive: true });

  for (const dir of dirs) {
    await fs.mkdir(path.join(projectDir, dir), { recursive: true });
  }
}

/**
 * @param {string} projectDir
 * @param {string} fileName
 * @param {Record<string, unknown>} content
 * @returns {Promise<void>}
 */
export async function writeJsonFile(projectDir, fileName, content) {
  await fs.writeFile(
    path.join(projectDir, fileName),
    JSON.stringify(content, null, 2)
  );
}

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @param {{ jsxImportSource: string, types: Array<string> }} options
 * @returns {Promise<void>}
 */
export async function createTsConfig(projectDir, answers, options) {
  const isTypeScript = answers.language === 'TypeScript';
  const fileName = isTypeScript ? 'tsconfig.json' : 'jsconfig.json';
  /** @type {Record<string, unknown>} */
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
      jsx: 'react-jsx',
      jsxImportSource: options.jsxImportSource,
      types: options.types,
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
          extends: ['./node_modules/retend-oxlint-plugin/recommended.json'],
        },
        null,
        2
      )
    ),
  ]);
}

/**
 * @param {string} projectDir
 * @param {{ language: string, styleSupport: 'css-modules' | 'tailwind' | null }} options
 * @returns {Promise<void>}
 */
export async function createVSCodeFolder(projectDir, options) {
  const vscodeDir = path.join(projectDir, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });

  const extensions = ['oxc.oxc-vscode'];

  if (options.language === 'TypeScript') {
    extensions.push('ms-vscode.vscode-typescript-next');
  }

  if (options.styleSupport === 'tailwind') {
    extensions.push('bradlc.vscode-tailwindcss');
  } else if (options.styleSupport === 'css-modules') {
    extensions.push('clinyong.vscode-css-modules');
  }

  const extensionsContent = {
    recommendations: extensions,
  };
  const settingsContent = {
    'editor.defaultFormatter': 'oxc.oxc-vscode',
    'editor.formatOnSave': false,
    'editor.codeActionsOnSave': {
      'source.organizeImports': 'always',
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
export async function createZedFolder(projectDir) {
  const zedDir = path.join(projectDir, '.zed');
  await fs.mkdir(zedDir, { recursive: true });

  const languageSettings = {
    format_on_save: 'on',
    prettier: { allowed: false },
    formatter: [
      { language_server: { name: 'oxfmt' } },
      { code_action: 'source.organizeImports' },
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
      JSX: languageSettings,
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
 * @param {boolean} includeDocs
 * @returns {Promise<void>}
 */
export async function createDocsFiles(projectDir, includeDocs) {
  if (!includeDocs) {
    return;
  }

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
