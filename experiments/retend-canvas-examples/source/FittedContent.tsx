import {
  Alignment,
  BoxShadow,
  type CanvasStyle,
  Length,
  TextAlign,
} from 'retend-canvas';
import { useRouter } from 'retend/router';

const FittedContent = () => {
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
      <text style={style.title}>Fitted Content</text>

      <rect style={style.box1}>
        <text style={style.exampleLabel}>Simple Text Fit</text>
        <rect style={style.fitText}>
          <text style={style.innerLabel}>Testing Fit</text>
        </rect>
      </rect>

      <rect style={style.box2}>
        <text style={style.exampleLabel}>Multiple Children</text>
        <rect style={style.fitChildren}>
          <rect style={style.child1} />
          <rect style={style.child2} />
        </rect>
      </rect>

      <rect style={style.box3}>
        <text style={style.exampleLabel}>Nested Fit</text>
        <rect style={style.outerFit}>
          <rect style={style.innerFit}>
            <text style={style.innerLabel}>Deep Nest</text>
          </rect>
        </rect>
      </rect>

      <rect style={style.box4}>
        <text style={style.exampleLabel}>Max Width (100px)</text>
        <rect style={style.fitMax}>
          <text style={style.wrappedLabel}>
            This text will be constrained by max width
          </text>
        </rect>
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
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
    fontSize: Length.Px(28),
    translate: [Length.Px(0), Length.Px(-220)],
  },
  exampleBox: {
    width: Length.Px(300),
    height: Length.Px(180),
    borderColor: '#e2e8f0',
    borderWidth: Length.Px(1),
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  },
  box1: {
    width: Length.Px(300),
    height: Length.Px(180),
    borderColor: '#e2e8f0',
    borderWidth: Length.Px(1),
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    translate: [Length.Px(-160), Length.Px(-100)],
  },
  box2: {
    width: Length.Px(300),
    height: Length.Px(180),
    borderColor: '#e2e8f0',
    borderWidth: Length.Px(1),
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    translate: [Length.Px(160), Length.Px(-100)],
  },
  box3: {
    width: Length.Px(300),
    height: Length.Px(180),
    borderColor: '#e2e8f0',
    borderWidth: Length.Px(1),
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    translate: [Length.Px(-160), Length.Px(100)],
  },
  box4: {
    width: Length.Px(300),
    height: Length.Px(180),
    borderColor: '#e2e8f0',
    borderWidth: Length.Px(1),
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    translate: [Length.Px(160), Length.Px(100)],
  },
  exampleLabel: {
    fontSize: Length.Px(14),
    color: '#64748b',
    translate: [Length.Px(10), Length.Px(10)],
  },
  fitText: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
    borderWidth: Length.Px(1),
    width: Length.FitContent,
    height: Length.FitContent,
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  },
  fitChildren: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: Length.Px(1),
    width: Length.FitContent,
    height: Length.FitContent,
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  },
  child1: {
    width: Length.Px(40),
    height: Length.Px(40),
    backgroundColor: '#ef4444',
    translate: [Length.Px(10), Length.Px(10)],
  },
  child2: {
    width: Length.Px(60),
    height: Length.Px(20),
    backgroundColor: '#b91c1c',
    translate: [Length.Px(30), Length.Px(40)],
  },
  outerFit: {
    backgroundColor: '#f1f5f9',
    width: Length.FitContent,
    height: Length.FitContent,
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    padding: Length.Px(10), // If supported
  },
  innerFit: {
    backgroundColor: '#3b82f6',
    color: 'white',
    width: Length.FitContent,
    height: Length.FitContent,
  },
  fitMax: {
    backgroundColor: '#fef9c3',
    borderColor: '#eab308',
    borderWidth: Length.Px(1),
    width: Length.FitContent,
    height: Length.FitContent,
    maxWidth: Length.Px(100),
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
  },
  innerLabel: {
    width: Length.Pct(100),
    textAlign: TextAlign.Center,
  },
  wrappedLabel: {
    width: Length.Pct(100),
    textAlign: TextAlign.Left,
  },
} satisfies Record<string, CanvasStyle>;

export default FittedContent;
