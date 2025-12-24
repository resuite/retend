import type { CanvasStyle } from '@/types';
import { Cell } from 'retend';

const useWindowSize = () => {
  const width = Cell.source(window.innerWidth);
  const height = Cell.source(window.innerHeight);

  window.addEventListener('resize', () => {
    width.set(window.innerWidth);
    height.set(window.innerHeight);
  });
  return { width, height };
};

const styles = {
  container: (width: number, height: number) => ({
    width,
    height,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    rowGap: 20,
  }),
  title: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
  subtitleBox: (viewportWidth: number) => ({
    borderColor: '#FFD700',
    padding: 20,
    width: viewportWidth - 80, // 40px padding on each side
  }),
  subtitle: {
    color: '#AAAAAA',
    fontSize: 16,
    textAlign: 'center',
  },
  output: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    padding: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 10,
    columnGap: 20,
  },
  button: {
    borderColor: '#5B9BD5',
    padding: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
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
