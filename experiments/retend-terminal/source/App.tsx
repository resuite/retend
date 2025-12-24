import type { TerminalStyle } from '@/types';
import { Cell } from 'retend';

const useWindowSize = () => {
  const width = Cell.source(process.stdout.columns || 80);
  const height = Cell.source(process.stdout.rows || 24);

  process.stdout.on('resize', () => {
    width.set(process.stdout.columns || 80);
    height.set(process.stdout.rows || 24);
  });

  return { width, height };
};

const styles = {
  container: (width: number, height: number) => ({
    width,
    height,
    backgroundColor: 'black',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    rowGap: 1,
  }),
  title: {
    color: 'white',
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
  subtitleBox: (viewportWidth: number) => ({
    borderColor: 'yellow',
    padding: 2,
    width: Math.max(20, viewportWidth - 16),
  }),
  subtitle: {
    color: 'gray',
    textAlign: 'center',
  },
  output: {
    color: 'white',
    fontWeight: 'bold',
    padding: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 1,
    columnGap: 2,
  },
  button: {
    borderColor: 'blue',
    padding: 1,
  },
  buttonText: {
    color: 'white',
    whiteSpace: 'nowrap',
  },
} as const;

const App = () => {
  const { width, height } = useWindowSize();
  const count = Cell.source(0);

  const rootStyle = Cell.derived(() =>
    styles.container(width.get(), height.get())
  );

  const subtitleBoxStyle = Cell.derived(() => styles.subtitleBox(width.get()));

  return (
    <view style={rootStyle}>
      <text style={styles.title}>Hello Retend!</text>

      <view style={subtitleBoxStyle}>
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
