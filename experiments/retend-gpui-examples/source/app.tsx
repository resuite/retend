import type { ReactiveStyle } from 'retend-gpui/jsx-runtime';

import { Cell } from 'retend';
import { useWindow } from 'retend-gpui';

export default function App() {
  const count = Cell.source(0);
  const { width, height } = useWindow();

  const handleClick = () => {
    count.set(count.get() + 1);
  };

  return (
    <div style={styles.container}>
      <div style={styles.output}>{count}</div>
      <div onClick={handleClick}>Increment</div>
      <div style={styles.windowSize}>
        {width} x {height}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    backgroundColor: '#000000',
    height: '100%',
    color: '#ffffff',
  },
  output: {
    fontSize: 50,
  },
  windowSize: {
    fontSize: 20,
  },
} satisfies Record<string, ReactiveStyle>;
