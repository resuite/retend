import type { CanvasKeyboardEventName, CanvasNodeEventName } from '../types';

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

export interface WorkerContextPointerEventMessage {
  type: 'event';
  kind?: 'pointer';
  data: {
    eventName: CanvasNodeEventName;
    x: number;
    y: number;
    pointerId: number;
  };
}

export interface WorkerContextKeyboardEventMessage {
  type: 'event';
  kind: 'keyboard';
  data: {
    eventName: CanvasKeyboardEventName;
    key: string;
    code: string;
    repeat: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
  };
}

export type WorkerContextEventMessage =
  | WorkerContextPointerEventMessage
  | WorkerContextKeyboardEventMessage;

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

export const WORKER_CONTEXT_KEYBOARD_EVENTS = [
  'keydown',
  'keyup',
] as const satisfies readonly CanvasKeyboardEventName[];
