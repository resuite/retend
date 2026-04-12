import { Cell } from 'retend';
import { Length, type CanvasStyle, type LengthValue } from 'retend-canvas-2d';

interface ObstacleProps {
  o: { x: number; type: 'small' | 'large'; id: number };
  height: Cell<number>;
  groundYOffset: number;
}

export function Obstacle(props: ObstacleProps) {
  const { o, height, groundYOffset } = props;
  const style = Cell.derived((): CanvasStyle => {
    const obstacleH = o.type === 'large' ? 50 : 30;
    const obstacleW = o.type === 'large' ? 30 : 20;
    return {
      translate: [
        Length.Px(o.x),
        Length.Px(height.get() - groundYOffset - obstacleH),
      ] as [LengthValue, LengthValue],
      width: Length.Px(obstacleW),
      height: Length.Px(obstacleH),
      backgroundColor: '#535353',
    };
  });

  // Pixelated Cactus Path (scales automatically to container)
  const d =
    'M 6,0 h 12 v 60 h -12 v -60 M 0,20 h 6 v 20 h -6 v -20 M 18,10 h 6 v 20 h -6 v -20';

  return <path style={style} d={d} />;
}
