import type { JSX } from 'retend/jsx-runtime';

const containerStyle: JSX.Style = {
  width: '100%',
  height: '100%',
  backgroundColor: 'blue',
  color: 'white',
  fontSize: 90,
};

const shapeStyle: JSX.Style = {
  top: 90,
  left: 60,
  backgroundColor: 'lime',
};

const App = () => {
  return (
    <rect style={containerStyle}>
      <shape
        points={[
          [0, 120],
          [120, 0],
          [240, 120],
        ]}
        style={shapeStyle}
      />
    </rect>
  );
};

export default App;
