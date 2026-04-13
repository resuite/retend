import { getActiveRenderer, onSetup } from 'retend';

import type { CanvasKeyboardEvent } from './tree';

import { CanvasRenderer } from './canvas-renderer';

export function onKeyDown(callback: (event: CanvasKeyboardEvent) => void) {
  const renderer = getActiveRenderer();
  if (!(renderer instanceof CanvasRenderer)) return;

  onSetup(() => {
    renderer.addKeyboardListener('keydown', callback);
    return () => {
      renderer.removeKeyboardListener('keydown', callback);
    };
  });
}

export function onKeyUp(callback: (event: CanvasKeyboardEvent) => void) {
  const renderer = getActiveRenderer();
  if (!(renderer instanceof CanvasRenderer)) return;

  onSetup(() => {
    renderer.addKeyboardListener('keyup', callback);
    return () => {
      renderer.removeKeyboardListener('keyup', callback);
    };
  });
}
