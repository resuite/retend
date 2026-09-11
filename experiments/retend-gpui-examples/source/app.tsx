import type { ReactiveStyle } from 'retend-gpui/jsx-runtime';

import { Cell } from 'retend';

export default function App() {
  const count = Cell.source(0);

  const handleClick = () => {
    count.set(count.get() + 1);
  };

  return (
    <div style={styles.container}>
      <div style={styles.output}>{count}</div>
      <div onClick={handleClick}>Increment</div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#454454',
    color: '#ffffff',
  },
  output: {
    fontSize: 50,
  },
} satisfies Record<string, ReactiveStyle>;
