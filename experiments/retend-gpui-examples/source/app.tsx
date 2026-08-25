import type { ReactiveStyle } from 'retend-gpui/jsx-runtime';

import { Cell } from 'retend';
import { useAppContext, useWindow } from 'retend-gpui';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    userSelect: 'none',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    color: '#ffffff',
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 20,
  },
  count: {
    fontSize: 70,
  },
} satisfies Record<string, ReactiveStyle>;

export default function App() {
  const count = Cell.source(0);
  const { startedAt } = useAppContext();
  const currentWindow = useWindow();

  const increment = () => count.set(count.get() + 1);
  return (
    <div style={styles.container}>
      <div>The verified HMR count is:</div>
      <div>Started at {startedAt.toLocaleTimeString()}</div>
      <div>
        Window size: {currentWindow.width} × {currentWindow.height}
      </div>
      <div style={styles.count}>{count}</div>
      <div style={styles.button} onClick={increment}>
        Increment
      </div>
    </div>
  );
}
