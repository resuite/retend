import type { JSX } from 'retend/jsx-runtime';

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

const circleStyle: JSX.Style = {
  top: '10%',
  left: '10%',
  height: '80%',
  width: '80%',
  backgroundColor: 'blue',
  borderRadius: 40,
  overflow: 'hidden',
  color: 'white',
  borderWidth: 3,
};

const App = () => {
  return (
    <rect style={containerStyle}>
      <rect style={innerStyle}>
        <rect style={circleStyle}>Hello1</rect>
      </rect>
    </rect>
  );
};

export default App;
