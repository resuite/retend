import { Cell, createNodesFromTemplate, onConnected } from 'retend';

import { useDevToolsRenderer } from '../core/DevToolsRendererScope';
import classes from '../styles/HighlightOverlay.module.css';

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

    if (node && node.output) {
      label = node.component.name;
      const flatNodes = createNodesFromTemplate(node.output, devRenderer);
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
    const animate = !devRenderer.disableHighlightTransition.get();
    const color = devRenderer.highlightColor.get();
    worker.postMessage({ type: 'target', rect, label, animate, color }, []);
  };

  devRenderer.hoveredNode.listen(updateTarget);
  devRenderer.disableHighlightTransition.listen(updateTarget);
  devRenderer.highlightColor.listen(updateTarget);

  onConnected(canvasRef, async (canvas) => {
    const offscreenCanvas = canvas.transferControlToOffscreen();
    const HighlightOverlayWorker = (
      await import('../workers/HighlightOverlay.worker.ts?worker')
    ).default;
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
