import type { JSX } from 'retend/jsx-runtime';

import { Cell, onSetup } from 'retend';
import { Angle, FontStyle, FontWeight, Length, TextAlign } from 'retend-canvas';

const containerStyle: JSX.Style = {
  width: Length.Pct(100),
  height: Length.Pct(100),
  backgroundColor: 'black',
};

const innerStyle: JSX.Style = {
  top: Length.Pct(5),
  left: Length.Pct(5),
  width: Length.Pct(90),
  height: Length.Pct(90),
  backgroundColor: 'lime',
};

const centerStyle: JSX.Style = {
  top: Length.Pct(40),
  left: Length.Pct(40),
  height: Length.Pct(20),
  width: Length.Pct(20),
  backgroundColor: 'blue',
  color: 'white',
  textAlign: TextAlign.Center,
  fontFamily: 'serif',
  fontWeight: FontWeight.Bold,
  fontStyle: FontStyle.Italic,
  fontSize: 29,
};

const App = () => {
  const rotate = Cell.source(Angle.Deg(0));
  const scale = Cell.source(1);

  onSetup(() => {
    let lastTick = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTick;
      lastTick = now;
      rotate.set(Angle.Deg(rotate.get().value + delta / 200));
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });

  return (
    <rect style={containerStyle}>
      <rect style={{ ...innerStyle }}>
        <rect style={{ ...centerStyle, rotate, scale }}>
          Hello World loremdud dshs dj fhffd hfdfh fdhv fhv
        </rect>
      </rect>
    </rect>
  );
};

export default App;
