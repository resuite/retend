import type { GpuiStyle } from 'retend-gpui';

import { Cell, If } from 'retend';

import {
  BOARD_PIXEL_HEIGHT,
  BOARD_PIXEL_WIDTH,
  BOARD_X,
  BOARD_Y,
  useSnakeGame,
} from './snake-game';
import { SnakeBoard } from './SnakeBoard';

const styles = {
  root: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    color: '#f7f4ea',
    userSelect: 'none',
  },
  eyebrow: {
    position: 'absolute',
    top: 30,
    left: BOARD_X,
    fontSize: 12,
    fontWeight: 700,
    color: '#8d8d86',
  },
  title: {
    position: 'absolute',
    top: 48,
    left: BOARD_X,
    fontSize: 88,
    fontWeight: 700,
    lineHeight: 92,
  },
  instructions: {
    position: 'absolute',
    top: 132,
    left: BOARD_X + 4,
    fontSize: 13,
    color: '#8d8d86',
  },
  scoreLabel: {
    position: 'absolute',
    top: 39,
    right: BOARD_X,
    fontSize: 11,
    fontWeight: 700,
    color: '#8d8d86',
    textAlign: 'right',
  },
  score: {
    position: 'absolute',
    top: 57,
    right: BOARD_X,
    fontSize: 62,
    fontWeight: 700,
    lineHeight: 64,
    textAlign: 'right',
  },
  board: {
    position: 'absolute',
    left: BOARD_X - 12,
    top: BOARD_Y - 12,
    width: BOARD_PIXEL_WIDTH + 24,
    height: BOARD_PIXEL_HEIGHT + 24,
    backgroundColor: '#161616',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#282828',
  },
  overlay: {
    position: 'absolute',
    left: BOARD_X,
    top: BOARD_Y + BOARD_PIXEL_HEIGHT / 2 - 58,
    width: BOARD_PIXEL_WIDTH,
    height: 116,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a0a0add',
    borderRadius: 16,
  },
  startTitle: { fontSize: 24, fontWeight: 700, color: '#d9ff43' },
  gameOverTitle: { fontSize: 34, fontWeight: 700, color: '#ff513c' },
  hint: { fontSize: 12, color: '#b7b6af' },
} satisfies Record<string, GpuiStyle>;

export default function App() {
  const { handleKeyDown, isGameOver, isStarted, reset, score, tiles } =
    useSnakeGame();
  const showStart = Cell.derived(() => !isStarted.get() && !isGameOver.get());
  const handleClick = () => {
    if (isGameOver.get()) reset();
  };

  return (
    <div
      style={styles.root}
      autoFocus
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      <div style={styles.eyebrow}>RETEND × GPUI / NATIVE SNAKE</div>
      <div style={styles.title}>SNAKE</div>
      <div style={styles.instructions}>
        ARROWS / WASD TO MOVE · R TO RESTART
      </div>
      <div style={styles.scoreLabel}>SCORE</div>
      <div style={styles.score}>{score}</div>
      <div style={styles.board} />
      <SnakeBoard tiles={tiles} />
      {If(showStart, () => (
        <div style={styles.overlay}>
          <div style={styles.startTitle}>PRESS AN ARROW TO START</div>
          <div style={styles.hint}>WASD WORKS TOO</div>
        </div>
      ))}
      {If(isGameOver, () => (
        <div style={styles.overlay}>
          <div style={styles.gameOverTitle}>GAME OVER</div>
          <div style={styles.hint}>PRESS R OR CLICK TO RESTART</div>
        </div>
      ))}
    </div>
  );
}
