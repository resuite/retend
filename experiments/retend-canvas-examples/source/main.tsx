import 'retend-canvas/jsx-runtime';
import { type CanvasRenderer, renderToCanvasContext } from 'retend-canvas';

const App = () => {
  return (
    <rect
      width="100%"
      height="100%"
      bgColor="blue"
      textColor="white"
      textSize={90}
    >
      Hello worlddd!
    </rect>
  );
};

let renderer: CanvasRenderer;
async function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  if (renderer) {
    renderer.requestRender({ width: rect.width, height: rect.height });
  } else {
    renderer = await renderToCanvasContext(ctx, App);
    renderer.requestRender({ width: rect.width, height: rect.height });
  }
  return ctx;
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
setupCanvas(canvas);
window.addEventListener('resize', () => setupCanvas(canvas));
