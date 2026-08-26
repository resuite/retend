import type { Cell } from 'retend';
import type { GpuiStyle } from 'retend-gpui';

import { For } from 'retend';

import { COLUMNS, ROWS } from './snake-game';

interface SnakeBoardProps {
  tiles: Cell<GpuiStyle>[][];
}

export function SnakeBoard(props: SnakeBoardProps) {
  return For(ROWS, (row) =>
    For(COLUMNS, (column) => <div style={props.tiles[row][column]} />)
  );
}
