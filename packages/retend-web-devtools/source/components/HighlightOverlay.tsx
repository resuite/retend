import { Cell, onConnected } from 'retend';

import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/HighlightOverlay.module.css';
import { matchToComponentNode } from '@/utils/componentMatching';
import { getHighlightInfo } from '@/utils/highlightUtils';
import HighlightOverlayWorker from '@/workers/HighlightOverlay.worker?worker&inline';

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

  const intercept = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const { target } = event;
    if (!(target instanceof Element)) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const cursorX = rect.left + rect.width / 2;
    const cursorY = rect.top + rect.height / 2;
    const selectedComponent = matchToComponentNode({
      target,
      cursorX,
      cursorY,
      devRenderer,
    });
    if (selectedComponent) {
      devRenderer.selectedNode.set(selectedComponent);
      devRenderer.isPickerActive.set(false);
      document.removeEventListener('click', intercept, options);
    }
  };

  const options = { capture: true };

  const updateTarget = () => {
    const hoveredNode = devRenderer.hoveredNode.get();
    const hoveredElement = devRenderer.pickerHoveredElement.get();
    const selectedNode = devRenderer.selectedNode.get();

    if (devRenderer.isPickerActive.get()) {
      if (!hoveredNode)
        document?.removeEventListener('click', intercept, options);
      else document?.addEventListener('click', intercept, options);
    }

    const { rect, label } = getHighlightInfo({
      node: hoveredNode,
      hoveredElement,
      devRenderer,
    });
    const { rect: selectedRect, label: selectedLabel } = getHighlightInfo({
      node: selectedNode,
      hoveredElement: null,
      devRenderer,
    });

    const color = devRenderer.highlightColor.get();
    worker.postMessage(
      { type: 'target', rect, label, selectedRect, selectedLabel, color },
      []
    );
  };

  const updateCursorPosition = () => {
    const cursorPosition = devRenderer.pickerCursorPosition.get();
    const color = devRenderer.highlightColor.get();
    worker.postMessage({ type: 'cursor', position: cursorPosition, color }, []);
  };

  devRenderer.hoveredNode.listen(updateTarget);
  devRenderer.selectedNode.listen(updateTarget);
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
