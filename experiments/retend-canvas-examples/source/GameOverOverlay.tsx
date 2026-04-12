import { Cell } from 'retend';
import {
  Alignment,
  Length,
  PointerEvents,
  TextAlign,
  type CanvasStyle,
  type LengthValue,
} from 'retend-canvas-2d';

interface GameOverOverlayProps {
  isGameOver: Cell<boolean>;
}

export function GameOverOverlay(props: GameOverOverlayProps) {
  const { isGameOver } = props;
  const style = Cell.derived(
    (): CanvasStyle => ({
      translate: [Length.Px(0), Length.Px(0)] as [LengthValue, LengthValue],
      width: Length.Vw(100),
      height: Length.Vh(100),
      backgroundColor: '#000000cc',
      opacity: isGameOver.get() ? 1 : 0,
      pointerEvents: isGameOver.get() ? PointerEvents.Auto : PointerEvents.None,
      zIndex: 100,
    })
  );

  return (
    <rect style={style}>
      <text
        style={{
          width: Length.Pct(100),
          textAlign: TextAlign.Center,
          alignSelf: Alignment.Center,
          fontSize: Length.Px(64),
          fontWeight: 900,
          color: '#ff4444',
        }}
      >
        GAME OVER
      </text>
      <text
        style={{
          width: Length.Pct(100),
          textAlign: TextAlign.Center,
          alignSelf: Alignment.Center,
          fontSize: Length.Px(24),
          fontWeight: 500,
          color: '#fafafa',
          translate: [Length.Px(0), Length.Px(60)],
        }}
      >
        CLICK TO RESTART
      </text>
    </rect>
  );
}
