import { Cell, For } from 'retend';
import { Length } from 'retend-canvas';
import { useRouteQuery } from 'retend/router';

import { stickers } from './data';
import { Sticker } from './Sticker';
import { useWindowSize } from './useWindowSize';

interface Point {
  x: number;
  y: number;
}

function getRandomPointInAnnulus(center: Point, minRadius: number): Point {
  const angle = Math.random() * 2 * Math.PI;
  const radius = minRadius + Math.random() * minRadius;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function isWithinBounds(point: Point, width: number, height: number): boolean {
  return point.x >= 0 && point.x < width && point.y >= 0 && point.y < height;
}

function isFarEnough(
  point: Point,
  grid: (Point | null)[],
  gridWidth: number,
  gridHeight: number,
  minDistance: number,
  cellSize: number
): boolean {
  const cellX = Math.floor(point.x / cellSize);
  const cellY = Math.floor(point.y / cellSize);
  const searchRadius = Math.ceil(minDistance / cellSize);

  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const nx = cellX + dx;
      const ny = cellY + dy;

      if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;

      const neighbor = grid[ny * gridWidth + nx];
      if (neighbor === null) continue;

      const distSq = (point.x - neighbor.x) ** 2 + (point.y - neighbor.y) ** 2;
      if (distSq < minDistance * minDistance) return false;
    }
  }
  return true;
}

function poissonDiskSampling(
  width: number,
  height: number,
  minDistance: number,
  maxAttempts = 30
): Point[] {
  const cellSize = minDistance / Math.sqrt(2);
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid: (Point | null)[] = Array.from(
    { length: gridWidth * gridHeight },
    () => null
  );

  const points: Point[] = [];
  const active: Point[] = [];

  const start: Point = {
    x: width / 2 + (Math.random() - 0.5) * minDistance,
    y: height / 2 + (Math.random() - 0.5) * minDistance,
  };

  points.push(start);
  active.push(start);
  grid[
    Math.floor(start.y / cellSize) * gridWidth + Math.floor(start.x / cellSize)
  ] = start;

  while (active.length > 0 && points.length < 1000) {
    const idx = Math.floor(Math.random() * active.length);
    const point = active[idx];
    let found = false;

    for (let i = 0; i < maxAttempts; i++) {
      const candidate = getRandomPointInAnnulus(point, minDistance);

      if (!isWithinBounds(candidate, width, height)) continue;

      if (
        isFarEnough(
          candidate,
          grid,
          gridWidth,
          gridHeight,
          minDistance,
          cellSize
        )
      ) {
        points.push(candidate);
        active.push(candidate);
        grid[
          Math.floor(candidate.y / cellSize) * gridWidth +
            Math.floor(candidate.x / cellSize)
        ] = candidate;
        found = true;
        break;
      }
    }

    if (!found) active.splice(idx, 1);
  }

  return points;
}

function generateTransforms(
  count: number,
  width: number,
  height: number,
  minDistance: number,
  stickerWidth: number,
  stickerHeight: number
) {
  const points = poissonDiskSampling(
    width - stickerWidth,
    height - stickerHeight,
    minDistance
  ).slice(0, count);
  const cx = width / 2;
  const cy = height / 2;

  return points.map((p) => {
    return {
      tx: p.x + stickerWidth / 2 - cx,
      ty: p.y + stickerHeight / 2 - cy,
      rotate: Math.random() * 40 - 20,
    };
  });
}

function createStickerTransforms(width: number, height: number) {
  const stickerHeight = Math.max(
    Math.min(
      Math.sqrt((width * height * 0.5) / (stickers.length * 0.8)),
      Math.min(height * 0.25, width * 0.28)
    ),
    Math.min(width, height) * 0.16
  );
  const stickerWidth = stickerHeight * 0.8;
  let minDistance = Math.hypot(stickerWidth, stickerHeight);
  let transforms = generateTransforms(
    stickers.length,
    width,
    height,
    minDistance,
    stickerWidth,
    stickerHeight
  );

  while (transforms.length < stickers.length) {
    minDistance *= 0.9;
    transforms = generateTransforms(
      stickers.length,
      width,
      height,
      minDistance,
      stickerWidth,
      stickerHeight
    );
  }

  return {
    stickerHeight,
    transforms,
  };
}

const Stickers = () => {
  const { width, height } = useWindowSize();
  const w = width.get();
  const h = height.get();
  const layout = createStickerTransforms(w, h);
  const query = useRouteQuery();
  const selectedStickerName = query.get('Selected');
  const selected = Cell.derived(() => {
    if (!selectedStickerName.get()) return null;
    return stickers.find((s) => s.name === selectedStickerName.get()) || null;
  });

  const handleSelect = (sticker: (typeof stickers)[number]) => {
    query.set('Selected', sticker.name);
  };

  const handleOutsideClick = () => {
    query.delete('Selected');
  };

  return (
    <rect style={{ height: Length.Pct(100) }} onClick={handleOutsideClick}>
      {For(stickers, (sticker, index) => (
        <Sticker
          index={index}
          {...sticker}
          initialTransform={layout.transforms[index.peek()]}
          height={layout.stickerHeight}
          onSelect={handleSelect}
          onDismiss={handleOutsideClick}
          selected={selected}
        />
      ))}
    </rect>
  );
};

export default Stickers;
