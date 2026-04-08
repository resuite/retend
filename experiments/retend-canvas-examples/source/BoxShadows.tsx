import {
  Alignment,
  BoxShadow,
  type CanvasStyle,
  Length,
  TextAlign,
} from 'retend-canvas';
import { useRouter } from 'retend/router';

const BoxShadows = () => {
  const router = useRouter();

  return (
    <rect style={style.container}>
      <rect
        style={style.back}
        onClick={() => {
          router.navigate('/');
        }}
      >
        <text style={style.backLabel}>Back</text>
      </rect>
      <text style={style.title}>Box Shadows</text>
      <rect style={style.soft}>
        <text style={style.label}>Soft Drop</text>
      </rect>
      <rect style={style.stack}>
        <text style={style.label}>Shadow Stack</text>
      </rect>
      <rect style={style.inset}>
        <text style={style.label}>Inset Glow</text>
      </rect>
    </rect>
  );
};

const style = {
  container: {
    backgroundColor: 'white',
    color: 'black',
    fontFamily: 'Maple Mono',
    fontSize: Length.Px(12),
    height: Length.Vh(100),
  },
  back: {
    width: Length.Px(92),
    height: Length.Px(44),
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: Length.Px(1),
    boxShadow: BoxShadow.Drop(
      Length.Px(0),
      Length.Px(12),
      Length.Px(24),
      '#0000001a'
    ),
    translate: [Length.Px(24), Length.Px(24)],
  },
  backLabel: {
    alignSelf: Alignment.Center,
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
  },
  title: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    fontSize: Length.Px(28),
    translate: [Length.Px(0), Length.Px(-180)],
  },
  soft: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    width: Length.Px(260),
    height: Length.Px(90),
    backgroundColor: '#1d4ed8',
    color: 'white',
    boxShadow: BoxShadow.Drop(
      Length.Px(0),
      Length.Px(22),
      Length.Px(44),
      '#0f172acc'
    ),
    translate: [Length.Px(0), Length.Px(-60)],
  },
  stack: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    width: Length.Px(260),
    height: Length.Px(90),
    backgroundColor: '#f97316',
    color: 'white',
    boxShadow: [
      BoxShadow.Drop(Length.Px(0), Length.Px(10), Length.Px(0), '#fb923c'),
      BoxShadow.Drop(Length.Px(0), Length.Px(24), Length.Px(24), '#7c2d12aa'),
    ],
    translate: [Length.Px(0), Length.Px(80)],
  },
  inset: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    width: Length.Px(260),
    height: Length.Px(90),
    backgroundColor: '#f8fafc',
    borderColor: '#38bdf8',
    borderWidth: Length.Px(1),
    boxShadow: BoxShadow.Inset(
      Length.Px(0),
      Length.Px(0),
      Length.Px(20),
      '#38bdf888'
    ),
    translate: [Length.Px(0), Length.Px(220)],
  },
  label: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
  },
} satisfies Record<string, CanvasStyle>;

export default BoxShadows;
