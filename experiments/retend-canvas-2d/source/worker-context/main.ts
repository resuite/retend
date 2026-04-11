import {
  WORKER_CONTEXT_EVENTS,
  type RendererRef,
  type WorkerContextEventMessage,
  type WorkerContextInitMessage,
  type WorkerContextResizeMessage,
} from './types';

function getCoordinates(canvas: HTMLCanvasElement, event: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function getPointerId(event: Event) {
  if (event instanceof PointerEvent) return event.pointerId;
  return 1;
}

function getPixelRatio() {
  return window.devicePixelRatio || 1;
}

function postResize(worker: Worker, width: number, height: number) {
  const payload: WorkerContextResizeMessage = {
    type: 'resize',
    dpr: getPixelRatio(),
    width,
    height,
  };
  worker.postMessage(payload);
}

export function connectToWorkerContext(
  canvas: HTMLCanvasElement,
  appWorker: Worker
): RendererRef {
  const rect = canvas.getBoundingClientRect();
  const offscreen = canvas.transferControlToOffscreen();
  const payload: WorkerContextInitMessage = {
    type: 'init',
    canvas: offscreen,
    dpr: getPixelRatio(),
    width: rect.width,
    height: rect.height,
  };
  appWorker.postMessage(payload, [offscreen]);

  for (const eventName of WORKER_CONTEXT_EVENTS) {
    canvas.addEventListener(eventName, (event) => {
      if (!(event instanceof MouseEvent)) return;
      const { x, y } = getCoordinates(canvas, event);
      const pointerEvent: WorkerContextEventMessage = {
        type: 'event',
        eventName,
        x,
        y,
        pointerId: getPointerId(event),
      };
      appWorker.postMessage(pointerEvent);
    });
  }

  return {
    resize(width: number, height: number) {
      postResize(appWorker, width, height);
    },
  };
}
