import { Cell } from 'retend';
import { type CanvasStyle, Length, TextAlign, Alignment } from 'retend-canvas';
import { useRouter } from 'retend/router';

import { useWindowSize } from './useWindowSize';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function fibonacciSphere(count: number) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = GOLDEN_ANGLE * i;
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    });
  }
  return points;
}

function rotateY(point: { x: number; y: number; z: number }, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos + point.z * sin,
    y: point.y,
    z: -point.x * sin + point.z * cos,
  };
}

function rotateX(point: { x: number; y: number; z: number }, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * cos - point.z * sin,
    z: point.y * sin + point.z * cos,
  };
}

const POINT_COUNT = 200;
const spherePoints = fibonacciSphere(POINT_COUNT);

const FibonacciSphere = () => {
  const router = useRouter();
  const { width: wCell, height: hCell } = useWindowSize();
  const rotation = Cell.source(0);
  const positions = Cell.derived(() => {
    const w = wCell.get();
    const h = hCell.get();
    const angle = rotation.get();
    const scale = Math.min(w, h) * 0.35;
    const cx = w / 2;
    const cy = h / 2;
    const perspective = 3;

    const pos: number[] = [];
    const sizes: number[] = [];
    const colors: string[] = [];

    for (const p of spherePoints) {
      let pt = rotateY(p, angle);
      pt = rotateX(pt, 0.3);
      const projScale = perspective / (perspective + pt.z);
      const screenX = cx + pt.x * scale * projScale;
      const screenY = cy + pt.y * scale * projScale;
      pos.push(screenX, screenY);
      sizes.push(4 * projScale);
      const opacity = 0.4 + 0.6 * ((pt.z + 1) / 2);
      const hue = 230 + pt.z * 30;
      colors.push(`hsla(${hue}, 70%, 60%, ${opacity})`);
    }

    return { pos, sizes, colors };
  });
  const particlePositions = Cell.derived(() => positions.get().pos);
  const particleSizes = Cell.derived(() => positions.get().sizes);
  const particleColors = Cell.derived(() => positions.get().colors);

  let animFrame: number | null = null;
  const startAnimation = () => {
    const tick = () => {
      rotation.set(rotation.get() + 0.008);
      animFrame = requestAnimationFrame(tick);
    };
    animFrame = requestAnimationFrame(tick);
  };

  startAnimation();

  return (
    <rect style={style.container}>
      <rect
        style={style.back}
        onClick={() => {
          if (animFrame != null) cancelAnimationFrame(animFrame);
          router.navigate('/');
        }}
      >
        <text style={style.backLabel}>Back</text>
      </rect>
      <text style={style.title}>Fibonacci Sphere</text>
      <text style={style.subtitle}>{POINT_COUNT} points</text>
      <particles
        positions={particlePositions}
        sizeMap={particleSizes}
        colorMap={particleColors}
        shape="circle"
        style={style.particles}
      />
    </rect>
  );
};

const style = {
  container: {
    backgroundColor: '#0f172a',
    color: 'white',
    fontFamily: 'Maple Mono',
    fontSize: Length.Px(12),
    height: Length.Vh(100),
  },
  back: {
    width: Length.Px(72),
    height: Length.Px(40),
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: Length.Px(1),
    translate: [Length.Px(16), Length.Px(16)],
  },
  backLabel: {
    alignSelf: Alignment.Center,
    textAlign: TextAlign.Center,
    width: Length.Pct(100),
  },
  title: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    fontSize: Length.Px(28),
    translate: [Length.Px(0), Length.Px(-240)],
  },
  subtitle: {
    alignSelf: Alignment.Center,
    justifySelf: Alignment.Center,
    color: '#94a3b8',
    translate: [Length.Px(0), Length.Px(-200)],
  },
  particles: {
    height: Length.Vh(100),
  },
} satisfies Record<string, CanvasStyle>;

export default FibonacciSphere;
