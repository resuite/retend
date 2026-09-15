import type { ReactiveStyle } from 'retend-gpui/jsx-runtime';

import { Cell } from 'retend';

export default function App() {
  const goodStatus = Cell.source('loading…');
  const badStatus = Cell.source('loading…');

  return (
    <div style={style.container}>
      <div style={style.heading}>Image load / error events</div>
      <div style={style.row}>
        <img
          src="https://picsum.photos/seed/retend/400/300"
          objectFit="cover"
          style={style.image}
          onLoad={() => goodStatus.set('loaded')}
          onError={() => goodStatus.set('failed')}
        />
        <div style={style.label}>Valid source: {goodStatus}</div>
      </div>
      <div style={style.row}>
        <img
          src="https://example.com/does-not-exist.png"
          objectFit="cover"
          style={style.image}
          onLoad={() => badStatus.set('loaded')}
          onError={() => badStatus.set('failed')}
        />
        <div style={style.label}>Broken source: {badStatus}</div>
      </div>
    </div>
  );
}

export const style = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
  },
  image: {
    width: 400,
    height: 300,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  label: {
    fontSize: 13,
    color: '#475569',
  },
} satisfies Record<string, ReactiveStyle>;
