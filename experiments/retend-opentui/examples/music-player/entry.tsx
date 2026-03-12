import { renderToCLI } from '../../source/index.js';
import { MusicPlayer } from './MusicPlayer.js';

await renderToCLI(MusicPlayer, {
  exitOnCtrlC: true,
  openConsoleOnError: true,
});
