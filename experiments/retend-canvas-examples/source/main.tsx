/// <reference types="vite/client" />
//
import 'retend-canvas-2d/jsx-runtime';
import AppWorker from './worker.ts?worker';

const worker = new AppWorker();
let resizeFrame: number | null = null;

function resizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio;
  const rect = canvas.getBoundingClientRect();
  worker.postMessage({
    type: 'resize',
    dpr,
    width: rect.width,
    height: rect.height,
  });
}

function requestResize(canvas: HTMLCanvasElement) {
  if (resizeFrame !== null) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    resizeCanvas(canvas);
  });
}

const canvas = document.getElementById('canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas not found');
}
const rect = canvas.getBoundingClientRect();
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage(
  {
    type: 'init',
    canvas: offscreen,
    dpr: window.devicePixelRatio,
    width: rect.width,
    height: rect.height,
  },
  [offscreen]
);
for (const eventName of [
  'click',
  'pointerdown',
  'pointermove',
  'pointerup',
] as const) {
  canvas.addEventListener(eventName, (event) => {
    if (!(event instanceof MouseEvent)) return;
    const rect = canvas.getBoundingClientRect();
    worker.postMessage({
      type: 'event',
      eventName,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  });
}
requestResize(canvas);
window.addEventListener('resize', () => requestResize(canvas));
