import 'retend-canvas/jsx-runtime';
import { type CanvasRenderer, renderToCanvasContext } from 'retend-canvas';

const App = () => {
  return (
    <rect width={661} height={100} bgColor="blue" textColor="white">
      <rect x={10} width={50} bgColor="green" height={50}>
        <circle width={50} height={50} bgColor="gray">
          Weee
        </circle>
      </rect>
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
    renderer.requestRender();
  } else {
    renderer = await renderToCanvasContext(ctx, App);
  }
  return ctx;
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
setupCanvas(canvas);
window.addEventListener('resize', () => setupCanvas(canvas));
