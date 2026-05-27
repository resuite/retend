import chalk from 'chalk';
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import semver from 'semver';

import { CONFIG, isBun, isPnpm, require } from './runtime.js';

/**
 * @returns {void}
 */
export function checkNodeVersion() {
  const currentVersion = process.version;
  if (!semver.satisfies(currentVersion, CONFIG.minNodeVersion)) {
    throw new Error(
      `Node.js version ${CONFIG.minNodeVersion} is required. Current version: ${currentVersion}`
    );
  }
}

/**
 * @param {string} projectDir
 * @returns {void}
 */
export function formatProject(projectDir) {
  const packageDir = path.dirname(require.resolve('oxfmt/package.json'));
  const oxfmtBin = path.join(packageDir, 'bin/oxfmt');
  execFileSync(oxfmtBin, ['--write', projectDir], { stdio: 'ignore' });
}

/**
 * @param {string} projectDir
 * @returns {Promise<void>}
 */
export async function initializeGit(projectDir) {
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
 * @param {string | undefined} projectDir
 * @returns {Promise<void>}
 */
export async function cleanupProject(projectDir) {
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
 * @param {string} projectName
 * @returns {void}
 */
export function displayCompletionMessage(projectName) {
  const installCommand = isBun
    ? 'bun install'
    : isPnpm
      ? 'pnpm install'
      : 'npm install';
  const devCommand = isBun
    ? 'bun run dev'
    : isPnpm
      ? 'pnpm run dev'
      : 'npm run dev';
  const buildCommand = isBun
    ? 'bun run build'
    : isPnpm
      ? 'pnpm run build'
      : 'npm run build';

  console.log(chalk.green('\n✨ Your project is ready! ✨'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(chalk.cyan('1. Navigate to your project folder:'));
  console.log(chalk.white(`   cd ${projectName}`));
  console.log(chalk.cyan('2. Install project dependencies:'));
  console.log(chalk.white(`   ${installCommand}`));
  console.log(chalk.cyan('3. Start the development server:'));
  console.log(chalk.white(`   ${devCommand}`));
  console.log(chalk.cyan('4. Open your browser and visit:'));
  console.log(chalk.white('   http://localhost:5229'));
  console.log(
    chalk.cyan(`5. Begin editing your project files in the 'source' directory`)
  );
  console.log(chalk.cyan('6. To build for production, run:'));
  console.log(chalk.white(buildCommand));
  console.log(chalk.blue('\nHappy coding! 🚀'));
}
