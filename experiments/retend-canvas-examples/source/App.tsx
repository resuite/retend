import type { JSX } from 'retend/jsx-runtime';

import { FontStyle, FontWeight, Length, TextAlign } from 'retend-canvas';

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
  top: Length.Pct(30),
  left: Length.Pct(30),
  height: Length.Pct(20),
  width: Length.Pct(40),
  backgroundColor: 'blue',
  color: 'white',
  textAlign: TextAlign.Center,
  fontFamily: 'serif',
  fontWeight: FontWeight.Bold,
  fontStyle: FontStyle.Italic,
  fontSize: 29,
};

const App = () => {
  const name = 'oluwasefunmi';

  return (
    <rect style={containerStyle}>
      <rect style={innerStyle}>
        <rect style={centerStyle}>
          Hello, my name is {name}. How do you do?
        </rect>
      </rect>
    </rect>
  );
};

export default App;
