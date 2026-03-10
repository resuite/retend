import type { JSX } from 'retend/jsx-runtime';

import './jsx-runtime/index';
import { Cell } from 'retend';

const styles = {
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stack: {
    width: '24u',
    height: '14u',
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: '2u',
  },
  heading: {
    color: 'white',
    fontSize: '4u',
    fontWeight: 'bold',
  },
  counter: {
    color: 'white',
    fontSize: '3u',
    fontWeight: 'bold',
  },
  controls: {
    width: '14u',
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: '2u',
  },
  button: {
    width: '5u',
    height: '5u',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderColor: '#5B9BD5',
  },
  buttonLabel: {
    color: 'white',
    fontSize: '2u',
  },
} satisfies Record<string, JSX.Style>;

const App = () => {
  const count = Cell.source(0);

  return (
    <view style={styles.container}>
      <view style={styles.stack}>
        <text style={styles.heading}>Hello world</text>
        <text style={styles.counter}>Count: {count}</text>
        <view style={styles.controls}>
          <view
            style={styles.button}
            onClick={() => count.set(count.get() - 1)}
          >
            <text style={styles.buttonLabel}>-</text>
          </view>
          <view
            style={styles.button}
            onClick={() => count.set(count.get() + 1)}
          >
            <text style={styles.buttonLabel}>+</text>
          </view>
        </view>
      </view>
    </view>
  );
};

export default App;
