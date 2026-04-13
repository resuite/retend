import type { CanvasNodeEventName } from '../types';
import type { CanvasKeyboardEventName } from '../types';
import type {
  WorkerContextKeyboardEventMessage,
  WorkerContextPointerEventMessage,
} from '../worker-context/types';
import type { CanvasNode } from './node';

export class CanvasEvent {
  type: string;
  cancelable: boolean;
  defaultPrevented = false;
  #target: CanvasNode;
  #currentTarget: CanvasNode | null;

  constructor(type: string, cancelable: boolean, target: CanvasNode) {
    this.type = type;
    this.cancelable = cancelable;
    this.#target = target;
    this.#currentTarget = null;
  }

  get target() {
    return this.#target;
  }

  get currentTarget() {
    return this.#currentTarget;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  setCurrentTarget(currentTarget: CanvasNode | null) {
    this.#currentTarget = currentTarget;
  }
}

export class CanvasPointerEvent extends CanvasEvent {
  pointerId: number;
  x: number;
  y: number;
  #propagationStopped = false;

  constructor(
    type: CanvasNodeEventName,
    pointerId: number,
    x: number,
    y: number,
    target: CanvasNode
  ) {
    super(type, true, target);
    this.pointerId = pointerId;
    this.x = x;
    this.y = y;
  }

  get propagationStopped() {
    return this.#propagationStopped;
  }

  stopPropagation() {
    this.#propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.#propagationStopped = true;
  }

  static fromMessage(
    message: WorkerContextPointerEventMessage,
    target: CanvasNode
  ): CanvasPointerEvent {
    return new CanvasPointerEvent(
      message.data.eventName,
      message.data.pointerId,
      message.data.x,
      message.data.y,
      target
    );
  }
}

export class CanvasKeyboardEvent extends CanvasEvent {
  key: string;
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  #propagationStopped = false;

  constructor(
    type: CanvasKeyboardEventName,
    target: CanvasNode,
    message: WorkerContextKeyboardEventMessage
  ) {
    super(type, true, target);
    const { data: init } = message;
    this.key = init.key;
    this.code = init.code;
    this.repeat = init.repeat;
    this.ctrlKey = init.ctrlKey;
    this.shiftKey = init.shiftKey;
    this.altKey = init.altKey;
    this.metaKey = init.metaKey;
  }

  get propagationStopped() {
    return this.#propagationStopped;
  }

  stopPropagation() {
    this.#propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.#propagationStopped = true;
  }
}
