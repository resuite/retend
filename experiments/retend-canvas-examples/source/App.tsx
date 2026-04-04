import type { JSX } from 'retend/jsx-runtime';

import { Alignment, Length, TextAlign } from 'retend-canvas';

const containerStyle: JSX.Style = {
  width: Length.Pct(100),
  height: Length.Pct(100),
};

const innerStyle: JSX.Style = {
  top: Length.Pct(5),
  left: Length.Pct(5),
  width: Length.Pct(90),
  height: Length.Pct(90),
  borderWidth: Length.Px(2),
  backgroundColor: 'lime',
};

const centerStyle: JSX.Style = {
  height: Length.Pct(20),
  width: Length.Pct(40),
  alignSelf: Alignment.Center,
  justifySelf: Alignment.Center,
  backgroundColor: 'blue',
  color: 'white',
  textAlign: TextAlign.Center,
  fontFamily: 'serif',
  fontSize: Length.Px(29),
};

const App = () => {
  return (
    <rect style={containerStyle}>
      <rect style={innerStyle}>
        <rect style={centerStyle}>
          <rect
            style={{
              width: Length.Pct(100),
              height: Length.Pct(30),
              alignSelf: Alignment.Center,
            }}
          >
            To be or not to be? That is the question.
          </rect>
        </rect>
      </rect>
    </rect>
  );
};

export default App;
