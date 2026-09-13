import type { ReactiveStyle } from 'retend-gpui/jsx-runtime';

import { useWindow } from 'retend-gpui';

export default function App() {
  const window = useWindow();

  const handleClick = () => {
    window.open({
      title: 'Child Window',
    });
  };

  return (
    <div style={styles.container}>
      2
      <div style={styles.box} onClick={handleClick}>
        Hello world.
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
  box: {
    width: 89,
    height: 89,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    opacity: 0.5,
  },
} satisfies Record<string, ReactiveStyle>;
