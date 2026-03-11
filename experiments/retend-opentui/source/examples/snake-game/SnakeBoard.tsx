import { TextAttributes } from '@opentui/core';
import { Cell, For, type Cell as RetendCell } from 'retend';

import type { Tile } from './types';

import { columns, rows } from './constants';

interface SnakeBoardProps {
  board: RetendCell<Tile[][]>;
}

export function SnakeBoard(props: SnakeBoardProps) {
  const { board } = props;

  return (
    <box
      borderColor="brightGreen"
      borderStyle="double"
      paddingX={1}
      paddingY={0}
    >
      <box>
        {For(rows, (row) => (
          <box flexDirection="row">
            {For(columns, (column) => {
              const tile = Cell.derived(() => board.get()[row][column]);
              const bg = Cell.derived(() => {
                const value = tile.get();
                if (value === 1) return 'orange';
                if (value === 2) return 'green';
                if (value === 3) return 'brightGreen';
                if (value === 4) return 'red';
                return '#161616';
              });
              const attributes = Cell.derived(() => {
                const value = tile.get();
                if (value === 1) return TextAttributes.BLINK;
                if (value === 3) {
                  return TextAttributes.BOLD | TextAttributes.BLINK;
                }
                if (value === 4) {
                  return TextAttributes.BOLD | TextAttributes.BLINK;
                }
                return TextAttributes.NONE;
              });

              return (
                <text fg={bg} bg={bg} attributes={attributes}>
                  {'  '}
                </text>
              );
            })}
          </box>
        ))}
      </box>
    </box>
  );
}
