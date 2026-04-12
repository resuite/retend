import type { Cell } from 'retend';

import { Length } from 'retend-canvas-2d';

interface ScoreBoardProps {
  score: Cell<number>;
}

export function ScoreBoard(props: ScoreBoardProps) {
  const { score } = props;
  return (
    <text
      style={{
        translate: [Length.Px(40), Length.Px(40)],
        fontSize: Length.Px(32),
        fontWeight: 800,
        color: '#00ff88',
      }}
    >
      SCORE: {score}
    </text>
  );
}
