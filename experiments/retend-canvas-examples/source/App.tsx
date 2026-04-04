import { Cell, onSetup } from 'retend';
import { Alignment, Length, Overflow } from 'retend-canvas';

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
          overflow: Overflow.Hidden,
        }}
      >
        <img
          src="https://pbs.twimg.com/profile_images/2007466268979351552/eKsxKS5C_400x400.png"
          alt="Image of Person"
          style={{
            height: Length.Px(700),
            width: Length.Px(700),
            alignSelf: Alignment.Center,
            justifySelf: Alignment.Center,
          }}
        />
      </rect>
    </rect>
  );
};

export default App;
