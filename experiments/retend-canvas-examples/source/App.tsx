import type { JSX } from 'retend/jsx-runtime';

import { Cell, onSetup } from 'retend';
import {
  Alignment,
  Duration,
  Easing,
  Length,
  type CanvasNode,
  type CanvasPointerEvent,
} from 'retend-canvas';

const styles = {
  container: {
    width: Length.Pct(100),
    height: Length.Pct(100),
    backgroundColor: '#f3efe3',
  },
  board: {
    width: Length.Px(780),
    height: Length.Px(430),
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    borderWidth: Length.Px(2),
    borderRadius: 28,
    backgroundColor: '#fffdf7',
  },
  title: {
    width: Length.Px(720),
    height: Length.Px(34),
    top: Length.Px(24),
    left: Length.Px(30),
    fontSize: Length.Px(18),
  },
  subtitle: {
    width: Length.Px(720),
    height: Length.Px(52),
    top: Length.Px(56),
    left: Length.Px(30),
  },
  stage: {
    width: Length.Px(360),
    height: Length.Px(288),
    top: Length.Px(112),
    left: Length.Px(30),
    borderWidth: Length.Px(2),
    borderRadius: 20,
    backgroundColor: '#edf6ff',
  },
  stageLabel: {
    width: Length.Px(300),
    height: Length.Px(28),
    top: Length.Px(16),
    left: Length.Px(20),
  },
  stageHint: {
    width: Length.Px(300),
    height: Length.Px(42),
    top: Length.Px(46),
    left: Length.Px(20),
  },
  button: {
    width: Length.Px(280),
    height: Length.Px(110),
    top: Length.Px(116),
    left: Length.Px(40),
    borderWidth: Length.Px(2),
    borderRadius: 20,
    backgroundColor: '#f7b267',
  },
  buttonTitle: {
    width: Length.Px(236),
    height: Length.Px(30),
    top: Length.Px(18),
    left: Length.Px(22),
    fontSize: Length.Px(18),
  },
  buttonHint: {
    width: Length.Px(236),
    height: Length.Px(46),
    top: Length.Px(52),
    left: Length.Px(22),
  },
  stageFooter: {
    width: Length.Px(300),
    height: Length.Px(42),
    top: Length.Px(236),
    left: Length.Px(20),
  },
  infoPanel: {
    width: Length.Px(330),
    height: Length.Px(288),
    top: Length.Px(112),
    left: Length.Px(420),
    borderWidth: Length.Px(2),
    borderRadius: 20,
    backgroundColor: '#d8f3dc',
  },
  infoTitle: {
    width: Length.Px(284),
    height: Length.Px(28),
    top: Length.Px(18),
    left: Length.Px(20),
  },
  infoBody: {
    width: Length.Px(284),
    height: Length.Px(84),
    top: Length.Px(48),
    left: Length.Px(20),
  },
  statLine1: {
    width: Length.Px(284),
    height: Length.Px(24),
    top: Length.Px(138),
    left: Length.Px(20),
  },
  statLineMode: {
    width: Length.Px(284),
    height: Length.Px(24),
    top: Length.Px(166),
    left: Length.Px(20),
  },
  statLine2: {
    width: Length.Px(284),
    height: Length.Px(24),
    top: Length.Px(194),
    left: Length.Px(20),
  },
  statLine3: {
    width: Length.Px(284),
    height: Length.Px(24),
    top: Length.Px(222),
    left: Length.Px(20),
  },
  ruleLine1: {
    width: Length.Px(284),
    height: Length.Px(24),
    top: Length.Px(248),
    left: Length.Px(20),
  },
  ruleLine2: {
    width: Length.Px(284),
    height: Length.Px(24),
    top: Length.Px(270),
    left: Length.Px(20),
  },
} satisfies Record<string, JSX.Style>;

const App = () => {
  const bubbleCount = Cell.source(0);
  const propCount = Cell.source(0);
  const refCount = Cell.source(0);
  const isSpread = Cell.source(false);
  const lastResult = Cell.source('Nothing clicked yet.');
  const buttonRef = Cell.source<CanvasNode | null>(null);
  const modeLabel = Cell.derived(() =>
    isSpread.get() ? 'Spread mode' : 'Compact mode'
  );

  const stageStyle = {
    ...styles.stage,
    backgroundColor: Cell.derived(() =>
      isSpread.get() ? '#f3ecff' : '#edf6ff'
    ),
    transitionDuration: Duration.Ms(280),
    transitionTimingFunction: Easing.EaseInOut,
    transitionProperty: 'backgroundColor',
  } satisfies JSX.Style;

  const buttonStyle = {
    ...styles.button,
    left: Cell.derived(() => (isSpread.get() ? Length.Px(92) : Length.Px(40))),
    top: Cell.derived(() => (isSpread.get() ? Length.Px(148) : Length.Px(116))),
    scale: Cell.derived(() => (isSpread.get() ? 1.08 : 1)),
    borderRadius: Cell.derived(() => (isSpread.get() ? 28 : 20)),
    backgroundColor: Cell.derived(() =>
      isSpread.get() ? '#ff9f6e' : '#f7b267'
    ),
    transitionDuration: Duration.Ms(280),
    transitionTimingFunction: Easing.EaseInOut,
    transitionProperty: [
      'left',
      'top',
      'scale',
      'borderRadius',
      'backgroundColor',
    ],
  } satisfies JSX.Style;

  const infoPanelStyle = {
    ...styles.infoPanel,
    top: Cell.derived(() => (isSpread.get() ? Length.Px(124) : Length.Px(112))),
    left: Cell.derived(() =>
      isSpread.get() ? Length.Px(408) : Length.Px(420)
    ),
    backgroundColor: Cell.derived(() =>
      isSpread.get() ? '#ffe5ec' : '#d8f3dc'
    ),
    transitionDuration: Duration.Ms(280),
    transitionTimingFunction: Easing.EaseInOut,
    transitionProperty: ['top', 'left', 'backgroundColor'],
  } satisfies JSX.Style;

  onSetup(() => {
    const node = buttonRef.get();
    if (node === null) return;
    const handleClick = () => {
      refCount.set(refCount.get() + 1);
    };
    node.addEventListener('click', handleClick);

    return () => {
      node.removeEventListener('click', handleClick);
    };
  });

  const handleParentClick = (event: CanvasPointerEvent) => {
    bubbleCount.set(bubbleCount.get() + 1);
    if (event.target === event.currentTarget) {
      isSpread.set(false);
      lastResult.set(
        'You clicked the blue parent area. Only the parent bubble handler ran, and the layout reset.'
      );
      return;
    }
    lastResult.set(
      isSpread.get()
        ? 'You clicked the orange child. All three handlers ran and the layout spread out.'
        : 'You clicked the orange child. All three handlers ran and the layout snapped back.'
    );
  };

  return (
    <rect style={styles.container}>
      <rect style={styles.board}>
        <rect style={styles.title}>Canvas Event Demo</rect>
        <rect style={styles.subtitle}>
          This shows three separate handlers reacting to one click: a child JSX
          handler, a child ref listener, and a parent bubbling handler.
        </rect>
        <rect style={stageStyle} onClick={handleParentClick}>
          <rect style={styles.stageLabel}>
            Try clicking inside this blue area.
          </rect>
          <rect style={styles.stageHint}>
            Click the orange child card first, then click the blue background
            around it.
          </rect>
          <rect
            ref={buttonRef}
            style={buttonStyle}
            onClick={() => {
              propCount.set(propCount.get() + 1);
              isSpread.set(!isSpread.get());
            }}
          >
            <rect style={styles.buttonTitle}>Child target</rect>
            <rect style={styles.buttonHint}>
              Clicking here should trigger all three handlers and animate the
              layout.
            </rect>
          </rect>
          <rect style={styles.stageFooter}>
            Blue background click = parent bubble only and resets the layout.
          </rect>
        </rect>
        <rect style={infoPanelStyle}>
          <rect style={styles.infoTitle}>What happened?</rect>
          <rect style={styles.infoBody}>{lastResult}</rect>
          <rect style={styles.statLine1}>Layout mode: {modeLabel}</rect>
          <rect style={styles.statLineMode}>
            Child JSX onClick: {propCount}
          </rect>
          <rect style={styles.statLine2}>Child ref listener: {refCount}</rect>
          <rect style={styles.statLine3}>
            Parent bubble handler: {bubbleCount}
          </rect>
          <rect style={styles.ruleLine1}>
            Orange click = 3 handlers + layout.
          </rect>
          <rect style={styles.ruleLine2}>Blue click = bubble + reset.</rect>
        </rect>
      </rect>
    </rect>
  );
};

export default App;
