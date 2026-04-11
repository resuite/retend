import type { JSX } from 'retend/jsx-runtime';

import type { WorkerContextMessage } from './types';

import { renderToCanvasContext, type CanvasRenderer } from '../canvas-renderer';

interface WorkerContextOptions {
  onInit?: () => void | Promise<void>;
}

function resizeRenderer(
  renderer: CanvasRenderer | null,
  width: number,
  height: number,
  dpr: number
) {
  if (!renderer) return;
  const canvas = renderer.host.ctx.canvas;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  renderer.host.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderer.updateViewport({ width, height });
  renderer.requestRender();
}

export function setupWorkerContext(
  App: () => JSX.Template,
  options: WorkerContextOptions = {}
) {
  let renderer: CanvasRenderer | null = null;

  addEventListener(
    'message',
    async (event: MessageEvent<WorkerContextMessage>) => {
      switch (event.data.type) {
        case 'init': {
          if (renderer) return;
          const ctx = event.data.canvas.getContext('2d');
          if (!ctx) return;

          renderer = await renderToCanvasContext(ctx, App);
          await options.onInit?.();
          resizeRenderer(
            renderer,
            event.data.width,
            event.data.height,
            event.data.dpr
          );
          break;
        }
        case 'resize': {
          resizeRenderer(
            renderer,
            event.data.width,
            event.data.height,
            event.data.dpr
          );
          break;
        }
        case 'event': {
          renderer?.dispatchEvent(
            event.data.eventName,
            event.data.x,
            event.data.y,
            event.data.pointerId
          );
          break;
        }
      }
    }
  );
}
