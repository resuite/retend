import type { JSX } from 'retend/jsx-runtime';

import { Cell, onSetup } from 'retend';

const containerStyle: JSX.Style = {
  width: '100%',
  height: '100%',
  backgroundColor: 'black',
};

const innerStyle: JSX.Style = {
  top: '5%',
  left: '5%',
  width: '90%',
  height: '90%',
  backgroundColor: 'lime',
};

const centerStyle: JSX.Style = {
  top: '30%',
  left: '30%',
  height: '40%',
  width: '40%',
  backgroundColor: 'blue',
  borderRadius: 40,
  overflow: 'hidden',
  color: 'white',
  borderWidth: 3,
};

const App = () => {
  const rotate = Cell.source('0deg');

  onSetup(() => {
    let lastTick = performance.now();

    const tick = (now: number) => {
      const nextRotate =
        String(Number.parseFloat(rotate.get()) + (now - lastTick) / 200) +
        'deg';
      lastTick = now;
      rotate.set(nextRotate);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });

  return (
    <rect style={containerStyle}>
      <rect style={{ ...innerStyle }}>
        <rect style={{ ...centerStyle, rotate }}>Hello World</rect>
      </rect>
    </rect>
  );
};

export default App;
