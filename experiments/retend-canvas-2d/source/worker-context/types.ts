import type { CanvasNodeEventName } from '../types';

export interface RendererRef {
  resize(width: number, height: number): void;
}

export interface WorkerContextInitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  dpr: number;
  width: number;
  height: number;
}

export interface WorkerContextResizeMessage {
  type: 'resize';
  dpr: number;
  width: number;
  height: number;
}

export interface WorkerContextEventMessage {
  type: 'event';
  eventName: CanvasNodeEventName;
  x: number;
  y: number;
  pointerId: number;
}

export type WorkerContextMessage =
  | WorkerContextInitMessage
  | WorkerContextResizeMessage
  | WorkerContextEventMessage;

export const WORKER_CONTEXT_EVENTS = [
  'click',
  'pointerdown',
  'pointermove',
  'pointerup',
] as const satisfies readonly CanvasNodeEventName[];
