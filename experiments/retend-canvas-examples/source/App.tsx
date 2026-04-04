import { Cell, onSetup } from 'retend';
import { Alignment, Duration, Length, TextAlign } from 'retend-canvas';

const App = () => {
  const scale = Cell.source(1);

  onSetup(() => {
    setTimeout(() => {
      scale.set(0.5);
    }, 3000);
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
          backgroundColor: 'brown',
        }}
      >
        <rect
          style={{
            scale,
            transitionProperty: 'scale',
            transitionDuration: Duration.Ms(500),
            height: Length.FitContent,
            width: Length.FitContent,
            maxWidth: Length.Pct(50),
            alignSelf: Alignment.Center,
            justifySelf: Alignment.Center,
            backgroundColor: 'black',
            color: 'white',
            textAlign: TextAlign.Center,
            fontFamily: 'serif',
            fontSize: Length.Px(40),
          }}
        >
          To be or not to be? That is the question.
        </rect>
      </rect>
    </rect>
  );
};

export default App;
