import { type CanvasStyle, Length } from 'retend-canvas-2d';
import { useRouter } from 'retend/router';

const App = () => {
  const router = useRouter();

  return (
    <rect style={style.container}>
      <text style={style.title}>RETEND</text>
      <text style={style.titleSub}>_CANVAS</text>
      <rect style={style.rule} />
      <rect
        style={style.link}
        onClick={() => {
          router.navigate('/stickers');
        }}
      >
        <text style={style.linkText}>STICKERS</text>
        <text style={style.linkArrow}>&gt;</text>
      </rect>
      <text style={style.linkDesc}>drag / drop / physics</text>
    </rect>
  );
};

const style = {
  container: {
    backgroundColor: '#0a0a0a',
    color: '#fafafa',
    fontFamily: 'Outfit',
    fontSize: Length.Px(12),
    height: Length.Vh(100),
  },
  title: {
    translate: [Length.Px(60), Length.Px(100)],
    fontSize: Length.Px(64),
    fontWeight: 800,
    color: '#fafafa',
  },
  titleSub: {
    translate: [Length.Px(60), Length.Px(160)],
    fontSize: Length.Px(64),
    fontWeight: 800,
    color: '#00ff88',
  },
  rule: {
    translate: [Length.Px(60), Length.Px(240)],
    width: Length.Px(280),
    height: Length.Px(2),
    backgroundColor: '#333',
  } satisfies CanvasStyle,
  link: {
    translate: [Length.Px(60), Length.Px(300)],
    width: Length.Px(280),
    height: Length.Px(56),
    backgroundColor: '#00ff88',
  } satisfies CanvasStyle,
  linkText: {
    translate: [Length.Px(20), Length.Px(14)],
    fontSize: Length.Px(18),
    fontWeight: 700,
    color: '#0a0a0a',
  },
  linkArrow: {
    translate: [Length.Px(244), Length.Px(14)],
    fontSize: Length.Px(18),
    fontWeight: 700,
    color: '#0a0a0a',
  },
  linkDesc: {
    translate: [Length.Px(60), Length.Px(370)],
    color: '#555',
    fontSize: Length.Px(11),
    fontWeight: 400,
  },
} satisfies Record<string, CanvasStyle>;

export default App;
