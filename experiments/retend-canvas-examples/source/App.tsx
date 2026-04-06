import type { JSX } from 'retend/jsx-runtime';

import { Cell } from 'retend';
import { Length, Alignment } from 'retend-canvas';

const App = () => {
  const count = Cell.source(0);

  function increment() {
    count.set(count.get() + 1);
  }

  function decrement() {
    count.set(count.get() - 1);
  }

  return (
    <rect style={styles.root}>
      <text style={styles.title}>Counter: {count}</text>

      <rect style={styles.buttonContainer}>
        <rect style={styles.button1} onClick={decrement}>
          <text style={styles.buttonText}>-</text>
        </rect>
        <rect style={styles.button2} onClick={increment}>
          <text style={styles.buttonText}>+</text>
        </rect>
      </rect>
    </rect>
  );
};

const styles = {
  root: {
    fontFamily: 'Inter, Helvetica Neue, sans-serif',
    height: Length.Pct(100),
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: Length.Px(48),
    color: '#111111',
    top: Length.Px(100),
    left: Length.Px(100),
  },

  buttonContainer: {
    top: Length.Px(200),
    left: Length.Px(100),
  },

  button1: {
    backgroundColor: '#007aff',
    width: Length.Px(50),
    height: Length.Px(50),
    borderRadius: Length.Px(8),
    left: Length.Px(0),
  },

  button2: {
    backgroundColor: '#007aff',
    width: Length.Px(50),
    height: Length.Px(50),
    borderRadius: Length.Px(8),
    left: Length.Px(70),
  },

  buttonText: {
    color: '#ffffff',
    fontSize: Length.Px(24),
    justifySelf: Alignment.Center,
    alignSelf: Alignment.Center,
  },
} satisfies Record<string, JSX.Style>;

export default App;
