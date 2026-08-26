import type { GpuiStyle } from 'retend-gpui';

import { Cell, onSetup } from 'retend';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type Segment = { x: number; y: number };
export type Tile = 0 | 1 | 2 | 3 | 4;
export interface KeyEvent {
  key?: string;
}

export const BOARD_WIDTH = 24;
export const BOARD_HEIGHT = 16;
export const TILE_SIZE = 31;
export const TILE_GAP = 3;
export const BOARD_PIXEL_WIDTH =
  BOARD_WIDTH * TILE_SIZE + (BOARD_WIDTH - 1) * TILE_GAP;
export const BOARD_PIXEL_HEIGHT =
  BOARD_HEIGHT * TILE_SIZE + (BOARD_HEIGHT - 1) * TILE_GAP;
export const BOARD_X = Math.round((1280 - BOARD_PIXEL_WIDTH) / 2);
export const BOARD_Y = 184;
export const ROWS = Array.from({ length: BOARD_HEIGHT }, (_, index) => index);
export const COLUMNS = Array.from({ length: BOARD_WIDTH }, (_, index) => index);

const TICK_RATE = 105;
const INITIAL_SNAKE: Segment[] = [
  { x: 9, y: 8 },
  { x: 8, y: 8 },
  { x: 7, y: 8 },
  { x: 6, y: 8 },
];
const INITIAL_FOOD: Segment = { x: 16, y: 8 };

function sameSegment(a: Segment, b: Segment): boolean {
  return a.x === b.x && a.y === b.y;
}

function randomFood(snake: Segment[]): Segment {
  const free: Segment[] = [];
  for (const y of ROWS) {
    for (const x of COLUMNS) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        free.push({ x, y });
      }
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? INITIAL_FOOD;
}

function canTurn(current: Direction, next: Direction): boolean {
  return !(
    (next === 'up' && current === 'down') ||
    (next === 'down' && current === 'up') ||
    (next === 'left' && current === 'right') ||
    (next === 'right' && current === 'left')
  );
}

function tileColor(value: Tile) {
  if (value === 1 || value === 4) return '#ff513c' as const;
  if (value === 3) return '#d9ff43' as const;
  if (value === 2) return '#a4d52c' as const;
  return '#202020' as const;
}

function tileStyle(row: number, column: number, value: Tile): GpuiStyle {
  return {
    position: 'absolute',
    left: BOARD_X + column * (TILE_SIZE + TILE_GAP),
    top: BOARD_Y + row * (TILE_SIZE + TILE_GAP),
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: tileColor(value),
    borderRadius: value === 1 ? 16 : value === 3 ? 8 : 5,
    opacity: value === 0 ? 0.62 : 1,
  };
}

export function useSnakeGame() {
  const snake = Cell.source<Segment[]>([...INITIAL_SNAKE]);
  const direction = Cell.source<Direction>('right');
  const pendingDirection = Cell.source<Direction>('right');
  const food = Cell.source<Segment>(INITIAL_FOOD);
  const score = Cell.source(0);
  const isStarted = Cell.source(false);
  const isGameOver = Cell.source(false);
  const crash = Cell.source<Segment | null>(null);

  const board = Cell.derived(() => {
    const next = ROWS.map(() => COLUMNS.map(() => 0 as Tile));
    const currentFood = food.get();
    next[currentFood.y][currentFood.x] = 1;
    const currentSnake = snake.get();
    for (let index = currentSnake.length - 1; index >= 0; index--) {
      const segment = currentSnake[index];
      next[segment.y][segment.x] = index === 0 ? 3 : 2;
    }
    const currentCrash = crash.get();
    if (currentCrash) next[currentCrash.y][currentCrash.x] = 4;
    return next;
  });
  const tiles: Cell<GpuiStyle>[][] = [];
  for (const row of ROWS) {
    const rowTiles: Cell<GpuiStyle>[] = [];
    for (const column of COLUMNS) {
      const tile = Cell.derived(() => board.get()[row][column]);
      const style = Cell.derived(() => tileStyle(row, column, tile.get()));
      rowTiles.push(style);
    }
    tiles.push(rowTiles);
  }

  const reset = () => {
    Cell.batch(() => {
      snake.set([...INITIAL_SNAKE]);
      direction.set('right');
      pendingDirection.set('right');
      food.set(INITIAL_FOOD);
      score.set(0);
      isStarted.set(false);
      isGameOver.set(false);
      crash.set(null);
    });
  };

  const requestDirection = (next: Direction) => {
    if (!canTurn(direction.get(), next)) return;
    Cell.batch(() => {
      pendingDirection.set(next);
      isStarted.set(true);
    });
  };

  const handleKeyDown = (event: KeyEvent) => {
    const key = event.key?.toLowerCase();
    if (key === 'up' || key === 'w') requestDirection('up');
    else if (key === 'down' || key === 's') requestDirection('down');
    else if (key === 'left' || key === 'a') requestDirection('left');
    else if (key === 'right' || key === 'd') requestDirection('right');
    else if (key === 'r' || key === 'enter') reset();
  };

  const crashAt = (segment: Segment) => {
    Cell.batch(() => {
      crash.set(segment);
      isGameOver.set(true);
    });
  };

  const step = () => {
    if (!isStarted.get() || isGameOver.get()) return;
    const nextDirection = pendingDirection.get();
    direction.set(nextDirection);
    const currentSnake = snake.get();
    const head = currentSnake[0];
    const nextHead = { ...head };
    if (nextDirection === 'up') nextHead.y -= 1;
    else if (nextDirection === 'down') nextHead.y += 1;
    else if (nextDirection === 'left') nextHead.x -= 1;
    else nextHead.x += 1;

    if (
      nextHead.x < 0 ||
      nextHead.y < 0 ||
      nextHead.x >= BOARD_WIDTH ||
      nextHead.y >= BOARD_HEIGHT
    ) {
      crashAt(head);
      return;
    }

    const ate = sameSegment(nextHead, food.get());
    const body = ate ? currentSnake : currentSnake.slice(0, -1);
    if (body.some((segment) => sameSegment(segment, nextHead))) {
      crashAt(nextHead);
      return;
    }

    const nextSnake = [nextHead, ...currentSnake];
    if (!ate) nextSnake.pop();
    if (ate) {
      Cell.batch(() => {
        snake.set(nextSnake);
        score.set(score.get() + 1);
        food.set(randomFood(nextSnake));
      });
    } else {
      snake.set(nextSnake);
    }
  };

  onSetup(() => {
    const interval = setInterval(step, TICK_RATE);
    return () => clearInterval(interval);
  });

  return { handleKeyDown, isGameOver, isStarted, reset, score, tiles };
}
