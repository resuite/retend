import { Alignment, Length, TextAlign } from 'retend-canvas';

const App = () => {
  return (
    <rect style={{ width: Length.Pct(100), height: Length.Pct(100) }}>
      <rect
        style={{
          top: Length.Pct(5),
          left: Length.Pct(5),
          width: Length.Pct(90),
          height: Length.Pct(90),
          borderWidth: Length.Px(2),
          backgroundColor: 'brown',
        }}
      >
        <rect
          style={{
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
