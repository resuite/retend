/// <reference path="./jsx-runtime/index.d.ts" />
import { Cell } from 'retend';

const styles = {
  container: {
    width: '100%' as const,
    height: '100%' as const,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    rowGap: '2u' as const,
  },
  title: {
    color: 'white',
    fontSize: '4u' as const,
    fontWeight: 'bold' as const,
    textDecoration: 'underline' as const,
  },
  subtitleBox: {
    borderColor: '#FFD700',
    padding: '2u' as const,
    width: '90%' as const,
  },
  subtitle: {
    color: '#AAAAAA',
    fontSize: '2u' as const,
    textAlign: 'center' as const,
  },
  output: {
    color: 'white',
    fontSize: '3u' as const,
    fontWeight: 'bold' as const,
    padding: '1u' as const,
  },
  buttonRow: {
    flexDirection: 'row' as const,
    padding: '1u' as const,
    columnGap: '2u' as const,
  },
  button: {
    borderColor: '#5B9BD5',
    padding: '2u' as const,
  },
  buttonText: {
    color: 'white',
    fontSize: '2u' as const,
    whiteSpace: 'nowrap' as const,
  },
} as const;

const App = () => {
  const count = Cell.source(0);

  return (
    <view style={styles.container}>
      <text style={styles.title}>Hello Retend!</text>

      <view style={styles.subtitleBox}>
        <text style={styles.subtitle}>
          A lightweight framework for building fluid apps. Use JSX to create
          dynamic interfaces, leveraging built-in reactivity for automatic
          updates. No Virtual DOM. No re-renders. Just fast, direct control.
        </text>
      </view>

      <text style={styles.output}>Count: {count}</text>

      <view style={styles.buttonRow}>
        <view style={styles.button} onClick={() => count.set(count.get() - 1)}>
          <text style={styles.buttonText}>- Decrement</text>
        </view>
        <view style={styles.button} onClick={() => count.set(count.get() + 1)}>
          <text style={styles.buttonText}>+ Increment</text>
        </view>
      </view>
    </view>
  );
};

export default App;
