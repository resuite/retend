import { Cell } from 'retend';
import { Length, TextAlign } from 'retend-canvas';

const App = () => {
  const count = Cell.source(0);

  return (
    <rect
      style={{
        width: Length.Pct(100),
        height: Length.Pct(100),
        backgroundColor: '#fdfdfd',
      }}
      onClick={() => count.set(count.get() + 1)}
    >
      <rect
        style={{
          top: Length.Pct(45),
          left: Length.Px(0),
          width: Length.Pct(100),
          textAlign: TextAlign.Center,
        }}
      >
        <rect
          style={{
            fontSize: Length.Px(180),
            fontWeight: 800,
            color: '#1a1a1a',
            width: Length.Pct(100),
          }}
        >
          {count}
        </rect>
        <rect
          style={{
            top: Length.Px(160),
            fontSize: Length.Px(16),
            fontWeight: 500,
            color: '#666',
            width: Length.Pct(100),
          }}
        >
          RETEND-CANVAS
        </rect>
      </rect>
    </rect>
  );
};

export default App;
