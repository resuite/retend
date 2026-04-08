import {
  type CanvasNodeEventName,
  type CanvasRenderer,
  renderToCanvasContext,
} from 'retend-canvas';
import { createRouterRoot } from 'retend/router';

import { createRouter } from './router';

let renderer: CanvasRenderer | null = null;
let router = createRouter();

function resizeRenderer(width: number, height: number, dpr: number) {
  if (!renderer) return;
  const canvas = renderer.host.ctx.canvas;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  renderer.host.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderer.updateViewport({ width, height });
  renderer.requestRender();
}

interface InitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  dpr: number;
  width: number;
  height: number;
}

interface ResizeMessage {
  type: 'resize';
  dpr: number;
  width: number;
  height: number;
}

interface PointerEventMessage {
  type: 'event';
  eventName: CanvasNodeEventName;
  x: number;
  y: number;
}

type Message =
  | MessageEvent<InitMessage>
  | MessageEvent<ResizeMessage>
  | MessageEvent<PointerEventMessage>;

addEventListener('message', async (event: Message) => {
  switch (event.data.type) {
    case 'init': {
      if (renderer) return;
      const ctx = event.data.canvas.getContext('2d');
      if (!ctx) return;

      renderer = await renderToCanvasContext(ctx, () => {
        return createRouterRoot(router);
      });
      router.navigate('/');
      resizeRenderer(event.data.width, event.data.height, event.data.dpr);
      break;
    }
    case 'resize': {
      resizeRenderer(event.data.width, event.data.height, event.data.dpr);
      break;
    }
    case 'event': {
      renderer?.dispatchEvent(event.data.eventName, event.data.x, event.data.y);
      break;
    }
  }
});

export default {};
