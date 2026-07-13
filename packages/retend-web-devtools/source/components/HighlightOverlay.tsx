import { Cell, onConnected } from 'retend';

import { useDevToolsRenderer } from '@/core/DevToolsRendererScope';
import classes from '@/styles/HighlightOverlay.module.css';
import { matchToComponentNode } from '@/utils/componentMatching';
import { getHighlightInfo } from '@/utils/highlightUtils';
import HighlightOverlayWorker from '@/workers/HighlightOverlay.worker?worker&inline';

export function HighlightOverlay() {
  const devRenderer = useDevToolsRenderer();
  const canvasRef = Cell.source<HTMLCanvasElement | null>(null);
  const options: AddEventListenerOptions = { capture: true };
  let worker: Worker | null = null;
  let isInterceptingClicks = false;

  const updateViewport = () => {
    if (!worker) return;
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

  const updateClickInterceptor = () => {
    const shouldInterceptClicks =
      devRenderer.isPickerActive.get() &&
      devRenderer.hoveredNode.get() !== null;

    if (shouldInterceptClicks === isInterceptingClicks) {
      return;
    }

    if (shouldInterceptClicks) {
      document.addEventListener('click', intercept, options);
    } else {
      document.removeEventListener('click', intercept, options);
    }
    isInterceptingClicks = shouldInterceptClicks;
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
      updateClickInterceptor();
    }
  };

  const updateTarget = () => {
    updateClickInterceptor();

    const hoveredNode = devRenderer.hoveredNode.get();
    const hoveredElement = devRenderer.pickerHoveredElement.get();
    const selectedNode = devRenderer.selectedNode.get();

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
    worker?.postMessage(
      { type: 'target', rect, label, selectedRect, selectedLabel, color },
      []
    );
  };

  const updateCursorPosition = () => {
    const cursorPosition = devRenderer.pickerCursorPosition.get();
    const color = devRenderer.highlightColor.get();
    worker?.postMessage(
      { type: 'cursor', position: cursorPosition, color },
      []
    );
  };

  devRenderer.hoveredNode.listen(updateTarget);
  devRenderer.selectedNode.listen(updateTarget);
  devRenderer.highlightColor.listen(updateTarget);
  devRenderer.pickerHoveredElement.listen(updateTarget);
  devRenderer.isPickerActive.listen(updateTarget);
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
      document.removeEventListener('click', intercept, options);
      isInterceptingClicks = false;
      worker?.postMessage({ type: 'dispose' }, []);
      worker?.terminate();
      worker = null;
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  });

  return <canvas ref={canvasRef} class={classes.overlay} />;
}
