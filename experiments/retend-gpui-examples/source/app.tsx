import type { GpuiColor } from 'retend-gpui';
import type { ReactiveStyle } from 'retend-gpui/jsx-runtime';

import { Cell } from 'retend';

export default function App() {
  const backgroundColor = Cell.source<GpuiColor>('#ffffff');

  return (
    <div style={styles.container}>
      <div style={{ ...styles.box, backgroundColor }}></div>
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
  box: {
    width: 89,
    height: 89,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    opacity: 0.5,
    transitionProperty: ['width', 'height', 'opacity'],
    transitionDuration: '500ms',
    transitionTimingFunction: 'ease',
    hover: {
      width: 89 * 2,
      height: 89 * 2,
      opacity: 1,
    },
  },
} satisfies Record<string, ReactiveStyle>;
