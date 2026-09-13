import type { ReactiveStyle } from 'retend-gpui/jsx-runtime';

export default function App() {
  return (
    <div style={styles.container}>
      <img
        style={styles.image}
        src="https://retend.dev/assets/icon-BdKmyllY.svg"
      />
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
  image: {
    width: 89,
    height: 89,
    active: {
      width: 85,
      height: 85,
    },
  },
} satisfies Record<string, ReactiveStyle>;
