/*
 * Isometric projection helpers for the renderer drawing. World units: x runs
 * down-right, y runs down-left, z runs up. One unit is UNIT pixels.
 */

export const UNIT = 64;
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

export type Point3 = [x: number, y: number, z: number];

export interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export function project([x, y, z]: Point3): [number, number] {
  return [(x - y) * COS * UNIT, (x + y) * SIN * UNIT - z * UNIT];
}

export function polygon(points: Point3[]): string {
  return points
    .map((point) => {
      const [sx, sy] = project(point);
      return `${sx.toFixed(1)},${sy.toFixed(1)}`;
    })
    .join(' ');
}

export function boxFaces(box: Box) {
  const { x, y, z, w, d, h } = box;
  const top = z + h;

  return {
    top: polygon([
      [x, y, top],
      [x + w, y, top],
      [x + w, y + d, top],
      [x, y + d, top],
    ]),
    right: polygon([
      [x + w, y, z],
      [x + w, y + d, z],
      [x + w, y + d, top],
      [x + w, y, top],
    ]),
    left: polygon([
      [x, y + d, z],
      [x + w, y + d, z],
      [x + w, y + d, top],
      [x, y + d, top],
    ]),
  };
}

/**
 * An SVG transform that lays content flat on a box's top face, centred.
 * The matrix maps the text's x axis onto world x and its y axis onto world y.
 */
export function onTop(box: Box): string {
  const [cx, cy] = project([
    box.x + box.w / 2,
    box.y + box.d / 2,
    box.z + box.h,
  ]);
  return `matrix(${COS} ${SIN} ${-COS} ${SIN} ${cx.toFixed(1)} ${cy.toFixed(1)})`;
}
