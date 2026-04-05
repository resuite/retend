import 'retend-canvas/jsx-runtime';
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});
const channel = new BroadcastChannel('retend-canvas-example');
const postToChannel = channel.postMessage.bind(channel);
let resizeFrame: number | null = null;

function resizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio;
  const rect = canvas.getBoundingClientRect();
  postToChannel({
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
    postToChannel({
      type: 'event',
      eventName,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  });
}
requestResize(canvas);
window.addEventListener('resize', () => requestResize(canvas));
