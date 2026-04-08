import {
  Alignment,
  BoxShadow,
  type CanvasStyle,
  Length,
  TextAlign,
} from 'retend-canvas';
import { useRouter } from 'retend/router';

const App = () => {
  const router = useRouter();

  return (
    <rect style={style.container}>
      <text style={style.title}>retend-canvas-examples</text>
      <text style={style.subtitle}>Choose a demo</text>
      <rect
        style={style.stickers}
        onClick={() => {
          router.navigate('/stickers');
        }}
      >
        <text style={style.label}>Stickers</text>
      </rect>
      <rect
        style={style.boxShadows}
        onClick={() => {
          router.navigate('/box-shadows');
        }}
      >
        <text style={style.label}>Box Shadows</text>
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
  title: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    fontSize: Length.Px(28),
    translate: [Length.Px(0), Length.Px(-140)],
  },
  subtitle: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    color: '#94a3b8',
    translate: [Length.Px(0), Length.Px(-100)],
  },
  stickers: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    width: Length.Px(280),
    height: Length.Px(80),
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: Length.Px(1),
    boxShadow: BoxShadow.Drop(
      Length.Px(0),
      Length.Px(18),
      Length.Px(36),
      '#00000066'
    ),
    translate: [Length.Px(0), Length.Px(-10)],
  },
  boxShadows: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    width: Length.Px(280),
    height: Length.Px(80),
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: Length.Px(1),
    boxShadow: BoxShadow.Drop(
      Length.Px(0),
      Length.Px(18),
      Length.Px(36),
      '#00000066'
    ),
    translate: [Length.Px(0), Length.Px(90)],
  },
  label: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
  },
} satisfies Record<string, CanvasStyle>;

export default App;
