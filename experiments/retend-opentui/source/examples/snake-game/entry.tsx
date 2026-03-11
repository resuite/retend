import { renderToCLI } from '../../index.js';
import { SnakeGame } from './SnakeGame.js';

await renderToCLI(SnakeGame, {
  exitOnCtrlC: true,
  openConsoleOnError: true,
});
