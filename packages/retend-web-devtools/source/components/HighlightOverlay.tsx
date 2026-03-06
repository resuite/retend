import { Cell, createNodesFromTemplate, onConnected } from 'retend';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import classes from '../styles/HighlightOverlay.module.css';
import HighlightOverlayWorker from '../workers/HighlightOverlay.worker?worker&inline';

export function HighlightOverlay() {
  const devRenderer = useDevToolsRenderer();
  const canvasRef = Cell.source<HTMLCanvasElement | null>(null);
  let worker: Worker;

  const updateViewport = () => {
    worker.postMessage(
      {
        type: 'resize',
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      },
      []
    );
  };

  const updateTarget = () => {
    let rect: DOMRect | null = null;
    let label = '';
    const node = devRenderer.hoveredNode.get();
    const hoveredElement = devRenderer.pickerHoveredElement.get();

    if (node && hoveredElement) {
      label = `${node.component.name}.${hoveredElement.tagName.toLowerCase()}`;
      rect = hoveredElement.getBoundingClientRect();
    } else if (node && node.output) {
      label = node.component.name;
      let flatNodes = createNodesFromTemplate(node.output, devRenderer);
      if (flatNodes.length === 1) {
        const anchorNode = flatNodes[0];
        if (anchorNode instanceof Comment) {
          const teleportedContainer = Reflect.get(
            anchorNode,
            '__retendTeleportedContainer'
          );
          if (teleportedContainer instanceof Element) {
            flatNodes = [teleportedContainer];
          }
        }
      }
      if (flatNodes.length > 0) {
        try {
          const first = flatNodes[0];
          const last = flatNodes[flatNodes.length - 1];

          const range = document.createRange();
          range.setStartBefore(first);
          range.setEndAfter(last);
          rect = range.getBoundingClientRect();
        } catch {}
      }
    }
    const color = devRenderer.highlightColor.get();
    worker.postMessage({ type: 'target', rect, label, color }, []);
  };

  const updateCursorPosition = () => {
    const cursorPosition = devRenderer.pickerCursorPosition.get();
    const color = devRenderer.highlightColor.get();
    worker.postMessage({ type: 'cursor', position: cursorPosition, color }, []);
  };

  devRenderer.hoveredNode.listen(updateTarget);
  devRenderer.highlightColor.listen(updateTarget);
  devRenderer.pickerHoveredElement.listen(updateTarget);
  devRenderer.highlightColor.listen(updateCursorPosition);
  devRenderer.pickerCursorPosition.listen(updateCursorPosition);

  onConnected(canvasRef, async (canvas) => {
    const offscreenCanvas = canvas.transferControlToOffscreen();

    worker = new HighlightOverlayWorker();
    worker.postMessage(
      {
        type: 'init',
        canvas: offscreenCanvas,
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      },
      [offscreenCanvas]
    );

    updateViewport();
    updateTarget();

    window.addEventListener('resize', updateViewport);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);

    return () => {
      worker.postMessage({ type: 'dispose' }, []);
      worker.terminate();
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  });

  return <canvas ref={canvasRef} class={classes.overlay} />;
}
