import { Cell, onSetup } from 'retend';
import { Alignment, Length, TextAlign } from 'retend-canvas';

const App = () => {
  const counter = Cell.source(0);

  onSetup(() => {
    const interval = setInterval(() => {
      counter.set(counter.get() + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  });

  return (
    <rect style={{ width: Length.Pct(100), height: Length.Pct(100) }}>
      <rect
        style={{
          width: Length.Pct(90),
          height: Length.Pct(90),
          alignSelf: Alignment.Center,
          justifySelf: Alignment.Center,
          borderWidth: Length.Px(2),
          backgroundColor: 'black',
        }}
      >
        <rect
          style={{
            height: Length.Px(80),
            width: Length.Px(80),
            maxWidth: Length.Pct(50),
            alignSelf: Alignment.Center,
            justifySelf: Alignment.Center,
            backgroundColor: 'white',
            color: 'white',
            textAlign: TextAlign.Center,
            fontFamily: 'serif',
            fontSize: Length.Px(40),
          }}
        ></rect>
      </rect>
    </rect>
  );
};

export default App;
