import { Cell } from 'retend';
import { Length, type CanvasStyle, type LengthValue } from 'retend-canvas-2d';

interface GroundProps {
  height: Cell<number>;
  groundYOffset: number;
}

export function Ground(props: GroundProps) {
  const { height, groundYOffset } = props;
  const style = Cell.derived(
    (): CanvasStyle => ({
      translate: [Length.Px(0), Length.Px(height.get() - groundYOffset)] as [
        LengthValue,
        LengthValue,
      ],
      width: Length.Vw(100),
      height: Length.Px(2),
      backgroundColor: '#333',
    })
  );

  return <rect style={style} />;
}
