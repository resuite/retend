import type { CanvasRenderer } from 'retend-canvas-2d';

import { Cell, getActiveRenderer } from 'retend';

export const useWindowSize = () => {
  const renderer = getActiveRenderer() as CanvasRenderer;
  return {
    width: Cell.source(renderer.viewport.width),
    height: Cell.source(renderer.viewport.height),
  };
};
