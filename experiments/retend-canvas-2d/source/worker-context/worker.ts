import type { JSX } from 'retend/jsx-runtime';

import { renderToCanvasContext, type CanvasRenderer } from '../canvas-renderer';
import { type WorkerContextMessage } from './types';

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
          const { canvas, dpr, width, height } = event.data;
          const ctx = canvas.getContext('2d');
          if (!ctx || renderer) return;

          renderer = await renderToCanvasContext(ctx, App);
          await options.onInit?.();
          resizeRenderer(renderer, width, height, dpr);
          break;
        }
        case 'resize': {
          const { width, height, dpr } = event.data;
          resizeRenderer(renderer, width, height, dpr);
          break;
        }
        case 'event': {
          renderer?.dispatchEvent(event.data);
          break;
        }
      }
    }
  );
}
