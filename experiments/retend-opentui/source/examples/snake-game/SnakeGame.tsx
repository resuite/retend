import { TextAttributes, type Renderable } from '@opentui/core';
import { Cell, If, onSetup } from 'retend';

import { SnakeBoard } from './SnakeBoard';
import { useSnakeGame } from './useSnakeGame';

export function SnakeGame() {
  const rootRef = Cell.source<Renderable | null>(null);
  const { board, handleKeyDown, isGameOver, score, step, tickRate } =
    useSnakeGame();

  onSetup(() => {
    const root = rootRef.get();
    if (root) root.focus();

    const interval = setInterval(step, tickRate);
    return () => clearInterval(interval);
  });

  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center">
      <box
        ref={rootRef}
        focusable
        onKeyDown={handleKeyDown}
        borderColor="brightGreen"
        borderStyle="double"
        paddingX={2}
        paddingY={1}
        alignItems="center"
      >
        <ascii_font text="SNAKE" font="block" color="brightGreen" />
        <text fg="gray" attributes={TextAttributes.BLINK}>
          arrows or wasd to move • r to restart
        </text>
        <text fg="yellow">score: {score}</text>
        {If(isGameOver, () => (
          <text fg="red" attributes={TextAttributes.BLINK}>
            game over • press r to restart
          </text>
        ))}
        <br />
        <SnakeBoard board={board} />
      </box>
    </box>
  );
}
