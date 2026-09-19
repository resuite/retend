import chalk from 'chalk';
import { createPromptModule } from 'inquirer';
import process from 'node:process';

import { args } from './runtime.js';

export const questions = [
  {
    type: 'list',
    name: 'target',
    message: chalk.magenta('Which platform are you targeting?'),
    choices: [
      { name: 'Web (DOM + Vite)', value: 'web' },
      { name: 'Native Desktop (GPUI)', value: 'gpui' },
    ],
    default: 'web',
    argKey: 'target',
    /** @param {string} value */
    processArg: (value) => (value === 'gpui' ? 'gpui' : 'web'),
  },
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
    /** @param {Record<string, any>} answers */
    when: (answers) => answers.target !== 'gpui',
  },
  {
    type: 'list',
    name: 'language',
    message: chalk.magenta('Which language would you like to use?'),
    choices: ['TypeScript', 'JavaScript'],
    default: 'TypeScript',
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
    /** @param {Record<string, any>} answers */
    when: (answers) => answers.target !== 'gpui',
  },
  {
    type: 'confirm',
    name: 'includeDocs',
    message: chalk.magenta('Include .docs folder for AI assistants?'),
    default: false,
    argKey: 'docs',
  },
];

export function parseArgs() {
  /** @type {Record<string, any>} */
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value) {
        options[key] = value;
      } else if (
        key === 'commit' &&
        args[i + 1] &&
        !args[i + 1].startsWith('-')
      ) {
        options[key] = args[i + 1];
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  return options;
}

export async function collectAnswers() {
  const cliOptions = parseArgs();
  if (cliOptions.template && !cliOptions.target) {
    cliOptions.target = cliOptions.template;
  }
  /** @type {Record<string, any>} */
  const answers = {};

  if (cliOptions.default) {
    for (const q of questions) {
      if (q.argKey && q.argKey in cliOptions) {
        const value = cliOptions[q.argKey];
        answers[q.name] = q.processArg ? q.processArg(value) : value;
      } else {
        answers[q.name] = q.default;
      }
    }

    const projectName = args.find((arg) => !arg.startsWith('-'));
    answers.projectName = projectName || 'my-app';
  } else {
    let questionsToAsk = questions.filter((q) => {
      if (q.argKey && q.argKey in cliOptions) {
        const value = cliOptions[q.argKey];
        answers[q.name] = q.processArg ? q.processArg(value) : value;
        return false;
      }
      return true;
    });

    const projectName = args.find((arg) => !arg.startsWith('-'));
    if (projectName) {
      answers.projectName = projectName;
      questionsToAsk = questionsToAsk.filter((q) => q.name !== 'projectName');
    }

    if (questionsToAsk.length > 0) {
      const prompt = createPromptModule({ output: process.stdout });
      const promptAnswers = await prompt(questionsToAsk);
      Object.assign(answers, promptAnswers);
    }
  }

  answers.cssPreprocessor = 'CSS';
  if (answers.target === 'gpui') {
    answers.useTailwind = false;
    answers.useSSG = false;
  }

  return { answers, cliOptions };
}
