import { renderToCLI } from '../../source/index.js';
import { SnakeGame } from './SnakeGame.js';

await renderToCLI(SnakeGame, {
  exitOnCtrlC: true,
  openConsoleOnError: true,
});
