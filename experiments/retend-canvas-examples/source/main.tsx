/// <reference types="vite/client" />
//
import {
  connectToWorkerContext,
  type RendererRef,
} from 'retend-canvas-2d/main';
import 'retend-canvas-2d/jsx-runtime';
import AppWorker from './worker.ts?worker';

const worker = new AppWorker();
let resizeFrame: number | null = null;
let rendererRef: RendererRef | null = null;

function resizeCanvas(canvas: HTMLCanvasElement) {
  if (!rendererRef) return;
  const rect = canvas.getBoundingClientRect();
  rendererRef.resize(rect.width, rect.height);
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
rendererRef = connectToWorkerContext(canvas, worker);
requestResize(canvas);
window.addEventListener('resize', () => requestResize(canvas));
