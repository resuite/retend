import 'retend-canvas/jsx-runtime';
import { type CanvasRenderer, renderToCanvasContext } from 'retend-canvas';

import App from './App';

let renderer: CanvasRenderer;
let resizeFrame: number | null = null;

async function setupCanvas(canvas: HTMLCanvasElement) {
  if (renderer) return renderer;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  renderer = await renderToCanvasContext(ctx, App);
  return renderer;
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  if (!renderer) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderer.requestRender({ width: rect.width, height: rect.height });
}

function requestResize(canvas: HTMLCanvasElement) {
  if (resizeFrame !== null) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    resizeCanvas(canvas);
  });
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
setupCanvas(canvas).then(() => {
  requestResize(canvas);
  window.addEventListener('resize', () => requestResize(canvas));
});
