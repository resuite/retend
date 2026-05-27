import chalk from 'chalk';
import path from 'node:path';
import process from 'node:process';
import ora from 'ora';

import { createProjectStructure } from './generation.js';
import {
  checkNodeVersion,
  cleanupProject,
  displayCompletionMessage,
  formatProject,
  initializeGit,
} from './lifecycle.js';
import { collectAnswers } from './prompts.js';

export async function main() {
  let projectDir;
  try {
    checkNodeVersion();

    const { answers, cliOptions } = await collectAnswers();
    projectDir = path.join(process.cwd(), answers.projectName);

    const spinner = ora({
      text: 'Creating project structure...',
      spinner: 'aesthetic',
      color: 'cyan',
    }).start();

    await createProjectStructure(projectDir, answers, cliOptions);
    formatProject(projectDir);
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
