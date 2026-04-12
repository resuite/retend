import { For } from 'retend';
import { Length, type CanvasStyle } from 'retend-canvas-2d';

import { BackLink } from './BackLink';
import { Dino } from './Dino';
import { GameOverOverlay } from './GameOverOverlay';
import { Ground } from './Ground';
import { Obstacle } from './Obstacle';
import { ScoreBoard } from './ScoreBoard';
import { useDinoGame } from './useDinoGame';

export default function DinoGame() {
  const {
    height,
    dinoY,
    score,
    isGameOver,
    obstacles,
    GROUND_Y_OFFSET,
    handleJump,
  } = useDinoGame();

  const mainStyle: CanvasStyle = {
    width: Length.Vw(100),
    height: Length.Vh(100),
    backgroundColor: '#0a0a0a',
    color: '#fafafa',
    fontFamily: 'Outfit',
  };

  return (
    <rect style={mainStyle} onClick={handleJump}>
      <ScoreBoard score={score} />
      <Dino dinoY={dinoY} height={height} groundYOffset={GROUND_Y_OFFSET} />
      <Ground height={height} groundYOffset={GROUND_Y_OFFSET} />

      {For(obstacles, (o) => {
        return (
          <Obstacle o={o} height={height} groundYOffset={GROUND_Y_OFFSET} />
        );
      })}

      <GameOverOverlay isGameOver={isGameOver} />
      <BackLink height={height} />
    </rect>
  );
}
