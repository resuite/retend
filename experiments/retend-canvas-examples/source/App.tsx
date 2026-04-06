import type { JSX } from 'retend/jsx-runtime';

import { Cell } from 'retend';
import {
  Length,
  Alignment,
  Duration,
  Easing,
  PointerEvents,
} from 'retend-canvas';

const PATH_A = 'M10 70 L70 10 L130 70 L110 70 L110 120 L30 120 L30 70 Z';
const PATH_B = 'M10 20 L70 80 L130 20 L100 20 L100 110 L40 110 L40 20 Z';

const CLIP_A = 'M10 10 L150 10 L150 150 L10 150 Z';
const CLIP_B = 'M80 0 L160 80 L80 160 L0 80 Z';

const App = () => {
  const count = Cell.source(0);
  const d = Cell.derived(() => (count.get() % 2 === 0 ? PATH_A : PATH_B));
  const clipPath = Cell.derived(() =>
    count.get() % 2 === 0 ? CLIP_A : CLIP_B
  );

  function increment() {
    count.set(count.get() + 1);
  }

  function decrement() {
    count.set(count.get() - 1);
  }

  return (
    <rect style={styles.root}>
      <text style={styles.title}>Counter: {count}</text>
      <text style={styles.help}>
        Use +/- to swap state A/B and compare motion
      </text>

      <rect style={styles.buttonContainer}>
        <rect style={styles.button1} onClick={decrement}>
          <text style={styles.buttonText}>-</text>
        </rect>
        <rect style={styles.button2} onClick={increment}>
          <text style={styles.buttonText}>+</text>
        </rect>
        <rect style={styles.buttonDisabledLayout}>
          <text style={styles.buttonDisabled} onClick={() => window.alert('')}>
            No Click!
          </text>
        </rect>
      </rect>

      <path d={d} style={styles.pathLinear} />
      <text style={styles.pathLinearLabel}>
        Linear: constant speed path morph
      </text>
      <path d={d} style={styles.pathEaseIn} />
      <text style={styles.pathEaseInLabel}>EaseIn: starts slow, speeds up</text>
      <path d={d} style={styles.pathEaseOut} />
      <text style={styles.pathEaseOutLabel}>
        EaseOut: starts fast, slows down
      </text>

      <rect
        style={{
          ...styles.clipDemo,
          clipPath,
        }}
      >
        <rect style={styles.clipLeft} />
        <rect style={styles.clipRight} />
      </rect>
      <text style={styles.clipLabel}>
        clipPath: reveal window morphs square to diamond
      </text>
    </rect>
  );
};

const styles = {
  root: {
    fontFamily: 'Inter, Helvetica Neue, sans-serif',
    height: Length.Pct(100),
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: Length.Px(48),
    color: '#111111',
    top: Length.Px(100),
    left: Length.Px(100),
  },

  help: {
    fontSize: Length.Px(16),
    color: '#666666',
    top: Length.Px(160),
    left: Length.Px(100),
  },

  buttonContainer: {
    top: Length.Px(200),
    left: Length.Px(100),
  },

  button1: {
    backgroundColor: '#007aff',
    width: Length.Px(50),
    height: Length.Px(50),
    borderRadius: Length.Px(8),
    left: Length.Px(0),
  },

  button2: {
    backgroundColor: '#007aff',
    width: Length.Px(50),
    height: Length.Px(50),
    borderRadius: Length.Px(8),
    left: Length.Px(70),
  },

  buttonText: {
    color: '#ffffff',
    fontSize: Length.Px(24),
    justifySelf: Alignment.Center,
    alignSelf: Alignment.Center,
  },

  buttonDisabledLayout: {
    backgroundColor: '#ff0000',
    width: Length.Px(100),
    height: Length.Px(30),
    borderRadius: Length.Px(8),
    top: Length.Px(60),
    left: Length.Px(10),
    pointerEvents: PointerEvents.None,
  },

  buttonDisabled: {
    color: '#ffffff',
    fontSize: Length.Px(14),
    justifySelf: Alignment.Center,
    alignSelf: Alignment.Center,
  },

  pathLinear: {
    top: Length.Px(320),
    left: Length.Px(100),
    borderWidth: Length.Px(7),
    borderColor: '#007aff',
    transitionProperty: 'd',
    transitionDuration: Duration.Ms(500),
    transitionTimingFunction: Easing.Linear,
  },

  pathLinearLabel: {
    top: Length.Px(300),
    left: Length.Px(100),
    fontSize: Length.Px(14),
    color: '#007aff',
  },

  pathEaseIn: {
    top: Length.Px(440),
    left: Length.Px(100),
    borderWidth: Length.Px(7),
    borderColor: '#ff2d55',
    transitionProperty: 'd',
    transitionDuration: Duration.Ms(700),
    transitionTimingFunction: Easing.EaseIn,
  },

  pathEaseInLabel: {
    top: Length.Px(420),
    left: Length.Px(100),
    fontSize: Length.Px(14),
    color: '#ff2d55',
  },

  pathEaseOut: {
    top: Length.Px(560),
    left: Length.Px(100),
    borderWidth: Length.Px(7),
    borderColor: '#34c759',
    transitionProperty: 'd',
    transitionDuration: Duration.Ms(900),
    transitionTimingFunction: Easing.EaseOut,
  },

  pathEaseOutLabel: {
    top: Length.Px(540),
    left: Length.Px(100),
    fontSize: Length.Px(14),
    color: '#34c759',
  },

  clipDemo: {
    top: Length.Px(360),
    left: Length.Px(380),
    width: Length.Px(160),
    height: Length.Px(160),
    transitionProperty: 'clipPath',
    transitionDuration: Duration.Ms(950),
    transitionTimingFunction: Easing.EaseInOut,
  },

  clipLabel: {
    top: Length.Px(330),
    left: Length.Px(380),
    fontSize: Length.Px(14),
    color: '#333333',
  },

  clipLeft: {
    width: Length.Px(80),
    height: Length.Px(160),
    backgroundColor: '#ff9500',
  },

  clipRight: {
    left: Length.Px(80),
    width: Length.Px(80),
    height: Length.Px(160),
    backgroundColor: '#5856d6',
  },
} satisfies Record<string, JSX.Style>;

export default App;
