/// <reference types="vite/client" />
/// <reference types="retend-web/jsx-runtime" />
import { runPendingSetupEffects, setActiveRenderer } from 'retend';
import { CanvasRenderer } from './renderer';
import App from './App';

const canvas = document.getElementById('canvas-root') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas root not found');
}

// Set canvas size to full screen
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (renderer) renderer.render();
}
window.addEventListener('resize', resize);
const renderer = new CanvasRenderer(canvas);
setActiveRenderer(renderer);

resize();

const appNodes = renderer.handleComponent(App, {});
renderer.append(renderer.root, appNodes);

runPendingSetupEffects();
