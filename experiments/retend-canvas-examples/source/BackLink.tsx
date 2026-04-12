import { Cell } from 'retend';
import {
  Alignment,
  Length,
  TextAlign,
  type CanvasStyle,
  type LengthValue,
} from 'retend-canvas-2d';
import { useRouter } from 'retend/router';

interface BackLinkProps {
  height: Cell<number>;
}

export function BackLink(props: BackLinkProps) {
  const { height } = props;
  const router = useRouter();

  const style = Cell.derived(
    (): CanvasStyle => ({
      translate: [Length.Px(40), Length.Px(height.get() - 80)] as [
        LengthValue,
        LengthValue,
      ],
      width: Length.Px(120),
      height: Length.Px(44),
      backgroundColor: '#333',
      color: '#fafafa',
      borderRadius: Length.Px(22),
      zIndex: 101,
    })
  );

  const handleBack = (e: any) => {
    e.stopImmediatePropagation();
    router.navigate('/');
  };

  return (
    <rect style={style} onClick={handleBack}>
      <text
        style={{
          width: Length.Pct(100),
          textAlign: TextAlign.Center,
          alignSelf: Alignment.Center,
        }}
      >
        BACK
      </text>
    </rect>
  );
}
