import { createGpuiProject } from './generators/gpui.js';
import { createWebProject } from './generators/web.js';

/**
 * @typedef {Record<string, any>} Answers
 * @typedef {Record<string, any>} CliOptions
 */

/**
 * @param {string} projectDir
 * @param {Answers} answers
 * @param {CliOptions} cliOptions
 * @returns {Promise<void>}
 */
export async function createProjectStructure(projectDir, answers, cliOptions) {
  if (answers.target === 'gpui') {
    await createGpuiProject(projectDir, answers, cliOptions);
    return;
  }

  await createWebProject(projectDir, answers, cliOptions);
}
