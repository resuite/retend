import type { JSX } from 'retend/jsx-runtime';

import { type CanvasRenderer, renderToCanvasContext } from 'retend-canvas';
import { createRouterRoot } from 'retend/router';

import { createRouter } from './router';

let renderer: CanvasRenderer;
const channel = new BroadcastChannel('retend-canvas-example');

function resizeRenderer(width: number, height: number, dpr: number) {
  const canvas = renderer.host.ctx.canvas;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  renderer.host.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderer.updateViewport({ width, height });
  renderer.requestRender();
}

addEventListener(
  'message',
  async (
    event: MessageEvent<{
      type: 'init';
      canvas: OffscreenCanvas;
      dpr: number;
      width: number;
      height: number;
    }>
  ) => {
    if (event.data.type !== 'init') return;
    if (renderer) return;
    const ctx = event.data.canvas.getContext('2d');
    if (!ctx) return;

    const router = createRouter();
    renderer = await renderToCanvasContext(ctx, () => {
      return createRouterRoot(router);
    });
    router.navigate('/');
    resizeRenderer(event.data.width, event.data.height, event.data.dpr);
  }
);

channel.addEventListener(
  'message',
  (
    event: MessageEvent<
      | { type: 'resize'; dpr: number; width: number; height: number }
      | {
          type: 'event';
          eventName: JSX.CanvasNodeEventName;
          x: number;
          y: number;
        }
    >
  ) => {
    if (!renderer) return;
    if (event.data.type === 'event') {
      renderer.dispatchEvent(event.data.eventName, event.data.x, event.data.y);
      return;
    }
    resizeRenderer(event.data.width, event.data.height, event.data.dpr);
  }
);
