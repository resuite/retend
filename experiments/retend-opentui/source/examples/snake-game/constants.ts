import type { Segment } from './types';

export const boardWidth = 24;
export const boardHeight = 16;
export const tickRate = 120;
export const crashTicks = 3;
export const rows = Array.from({ length: boardHeight }, (_, index) => index);
export const columns = Array.from({ length: boardWidth }, (_, index) => index);
export const initialSnake: Segment[] = [
  { x: 9, y: 8 },
  { x: 8, y: 8 },
  { x: 7, y: 8 },
];
export const initialFood: Segment = { x: 4, y: 5 };
