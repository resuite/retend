import { type CanvasRenderer, renderToCanvasContext } from 'retend-canvas';

import App from './App';

let renderer: CanvasRenderer;

function resizeRenderer(width: number, height: number, dpr: number) {
  const canvas = renderer.host.ctx.canvas;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  renderer.host.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderer.requestRender({ width, height });
}

addEventListener(
  'message',
  async (
    event: MessageEvent<
      | {
          type: 'init';
          canvas: OffscreenCanvas;
          dpr: number;
          width: number;
          height: number;
        }
      | {
          type: 'resize';
          dpr: number;
          width: number;
          height: number;
        }
    >
  ) => {
    if (event.data.type === 'init') {
      if (renderer) return;
      const ctx = event.data.canvas.getContext('2d');
      if (!ctx) return;
      renderer = await renderToCanvasContext(ctx, App);
      resizeRenderer(event.data.width, event.data.height, event.data.dpr);
      return;
    }

    if (!renderer) return;
    resizeRenderer(event.data.width, event.data.height, event.data.dpr);
  }
);
