import {
  CanvasRenderer,
  CanvasHost,
  renderToCanvasContext,
} from 'retend-canvas';
import { beforeEach, afterEach } from 'vitest';
import 'retend-canvas/jsx-runtime';

export function createOffscreenCanvas(
  width = 800,
  height = 600
): OffscreenCanvas {
  return new OffscreenCanvas(width, height);
}

export function createCanvasAndRenderer(width = 800, height = 600) {
  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const host = new CanvasHost(ctx, width, height);
  const renderer = new CanvasRenderer(host, { width, height });

  return { canvas, ctx, renderer, host };
}

export async function render(
  App: () => JSX.Template,
  width = 800,
  height = 600
) {
  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const renderer = await renderToCanvasContext(ctx, App);
  renderer.drawToScreen();
  return { canvas, ctx, renderer };
}

export function pixelAt(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number
) {
  return ctx.getImageData(x, y, 1, 1).data;
}

export function canvasSetup(width = 800, height = 600) {
  let renderer: CanvasRenderer;

  beforeEach(() => {
    renderer = createCanvasAndRenderer(width, height).renderer;
  });

  afterEach(() => {
    renderer = undefined as any;
  });

  return () => renderer;
}
