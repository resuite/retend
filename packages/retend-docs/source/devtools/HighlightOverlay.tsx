import { Cell, createNodesFromTemplate, onConnected } from 'retend';

import type { DevToolsDOMRenderer } from './devtools-renderer';

import { getComponentName } from './devtools-renderer';
import classes from './HighlightOverlay.module.css';

interface HighlightOverlayProps {
  devRenderer: DevToolsDOMRenderer;
}

export function HighlightOverlay(props: HighlightOverlayProps) {
  const { devRenderer } = props;
  const canvasRef = Cell.source<HTMLCanvasElement | null>(null);

  onConnected(canvasRef, (canvas) => {
    const worker = new Worker(
      new URL('./HighlightOverlay.worker.js', import.meta.url),
      { type: 'module' }
    );
    const offscreenCanvas = canvas.transferControlToOffscreen();
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
      let rect: { x: number; y: number; width: number; height: number } | null =
        null;
      let label = '';
      const node = devRenderer.hoveredNode.get();
      if (node && node.output) {
        label = getComponentName(node.component);
        const flatNodes = createNodesFromTemplate(node.output, devRenderer);
        if (flatNodes.length > 0) {
          const first = flatNodes[0];
          const last = flatNodes[flatNodes.length - 1];

          if (first.parentNode && last.parentNode) {
            try {
              const range = document.createRange();
              range.setStartBefore(first);
              range.setEndAfter(last);
              rect = range.getBoundingClientRect();
            } catch {}
          }
        }
      }
      const animate = !devRenderer.disableHighlightTransition.get();
      worker.postMessage({ type: 'target', rect, label, animate }, []);
    };

    updateViewport();
    updateTarget();
    devRenderer.hoveredNode.listen(updateTarget, { weak: true });
    devRenderer.disableHighlightTransition.listen(updateTarget, { weak: true });
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
