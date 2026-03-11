import { Cell } from 'retend';

import type { Direction, Segment, Tile } from './types';

import {
  boardHeight,
  boardWidth,
  columns,
  crashTicks,
  initialFood,
  initialSnake,
  rows,
  tickRate,
} from './constants';

export function useSnakeGame() {
  const snake = Cell.source<Segment[]>(initialSnake);
  const direction = Cell.source<Direction>('right');
  const food = Cell.source<Segment>(initialFood);
  const score = Cell.source(0);
  const isGameOver = Cell.source(false);
  const crash = Cell.source<Segment | null>(null);
  const pendingCrashTicks = Cell.source(0);
  const board = Cell.derived(() => {
    const nextBoard = rows.map(() => columns.map(() => 0 as Tile));
    const currentFood = food.get();
    nextBoard[currentFood.y][currentFood.x] = 1;

    const currentSnake = snake.get();
    let index = currentSnake.length - 1;
    while (index >= 0) {
      const part = currentSnake[index];
      nextBoard[part.y][part.x] = index === 0 ? 3 : 2;
      index -= 1;
    }

    const currentCrash = crash.get();
    if (currentCrash) nextBoard[currentCrash.y][currentCrash.x] = 4;

    return nextBoard;
  });

  const reset = () => {
    snake.set(initialSnake);
    direction.set('right');
    food.set(initialFood);
    score.set(0);
    isGameOver.set(false);
    crash.set(null);
    pendingCrashTicks.set(0);
  };

  const triggerCrash = (segment: Segment) => {
    crash.set(segment);
    pendingCrashTicks.set(crashTicks);
  };

  const handleKeyDown = (key: { name: string }) => {
    const name = key.name;
    const current = direction.get();

    if (name === 'up' || name === 'w') {
      if (current === 'down') return;
      direction.set('up');
      return;
    }

    if (name === 'down' || name === 's') {
      if (current === 'up') return;
      direction.set('down');
      return;
    }

    if (name === 'left' || name === 'a') {
      if (current === 'right') return;
      direction.set('left');
      return;
    }

    if (name === 'right' || name === 'd') {
      if (current === 'left') return;
      direction.set('right');
      return;
    }

    if (name !== 'r') return;
    reset();
  };

  const step = () => {
    if (isGameOver.get()) return;
    const nextCrashTicks = pendingCrashTicks.get();
    if (nextCrashTicks > 0) {
      pendingCrashTicks.set(nextCrashTicks - 1);
      if (nextCrashTicks === 1) {
        crash.set(null);
        isGameOver.set(true);
      }
      return;
    }

    const currentSnake = snake.get();
    const head = currentSnake[0];
    const nextHead = { x: head.x, y: head.y };
    const currentDirection = direction.get();

    if (currentDirection === 'up') nextHead.y -= 1;
    if (currentDirection === 'down') nextHead.y += 1;
    if (currentDirection === 'left') nextHead.x -= 1;
    if (currentDirection === 'right') nextHead.x += 1;

    if (
      nextHead.x < 0 ||
      nextHead.y < 0 ||
      nextHead.x >= boardWidth ||
      nextHead.y >= boardHeight
    ) {
      triggerCrash(head);
      return;
    }

    const currentFood = food.get();
    const ateFood =
      nextHead.x === currentFood.x && nextHead.y === currentFood.y;
    let index = 0;
    const lastIndex = currentSnake.length - 1;
    while (index < currentSnake.length) {
      if (!ateFood && index === lastIndex) break;
      const part = currentSnake[index];
      if (part.x === nextHead.x && part.y === nextHead.y) {
        triggerCrash(nextHead);
        return;
      }
      index += 1;
    }

    const nextSnake = [nextHead, ...currentSnake];
    if (!ateFood) nextSnake.pop();
    snake.set(nextSnake);

    if (!ateFood) return;

    score.set(score.get() + 1);

    let nextFood = currentFood;
    let blocked = true;
    while (blocked) {
      nextFood = {
        x: Math.floor(Math.random() * boardWidth),
        y: Math.floor(Math.random() * boardHeight),
      };
      blocked = false;
      let partIndex = 0;
      while (partIndex < nextSnake.length) {
        const part = nextSnake[partIndex];
        if (part.x === nextFood.x && part.y === nextFood.y) {
          blocked = true;
          break;
        }
        partIndex += 1;
      }
    }
    food.set(nextFood);
  };

  return {
    board,
    handleKeyDown,
    isGameOver,
    score,
    step,
    tickRate,
  };
}
