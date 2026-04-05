import 'retend-canvas/jsx-runtime';
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});
const channel = new BroadcastChannel('retend-canvas-example');
let resizeFrame: number | null = null;

function resizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio;
  const rect = canvas.getBoundingClientRect();
  channel.postMessage({
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

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
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
    const pointerEvent = event as MouseEvent;
    const rect = canvas.getBoundingClientRect();
    channel.postMessage({
      type: 'event',
      eventName,
      x: pointerEvent.clientX - rect.left,
      y: pointerEvent.clientY - rect.top,
    });
  });
}
requestResize(canvas);
window.addEventListener('resize', () => requestResize(canvas));
