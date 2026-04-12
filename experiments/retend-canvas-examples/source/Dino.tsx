import { Cell } from 'retend';
import { Length, type CanvasStyle, type LengthValue } from 'retend-canvas-2d';

interface DinoProps {
  dinoY: Cell<number>;
  height: Cell<number>;
  groundYOffset: number;
}

export function Dino(props: DinoProps) {
  const { dinoY, height, groundYOffset } = props;
  const style = Cell.derived(
    (): CanvasStyle => ({
      translate: [
        Length.Px(100),
        Length.Px(height.get() - groundYOffset + dinoY.get() - 44),
      ] as [LengthValue, LengthValue],
      width: Length.Px(44),
      height: Length.Px(44),
      backgroundColor: '#535353',
    })
  );

  // Pixelated Dino Path (scaled to ~44x44)
  const d =
    'M 20,0 h 20 v 12 h -20 v -12 M 0,12 h 30 v 20 h -30 v -20 M 0,16 h 4 v 8 h -4 v -8 M 8,32 h 6 v 6 h -6 v -6 M 24,32 h 6 v 6 h -6 v -6';

  return <path style={style} d={d} />;
}
