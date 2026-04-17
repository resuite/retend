import type { CanvasNodeEventName } from '../types';
import type { CanvasKeyboardEventName } from '../types';
import type {
  ContextKeyboardEventMessage,
  ContextPointerEventMessage,
} from '../worker-context/types';
import type { CanvasNode } from './node';

export class CanvasEvent extends Event {}

export class CanvasPointerEvent extends CanvasEvent {
  #target: CanvasNode;

  constructor(
    public type: CanvasNodeEventName,
    public pointerId: number,
    public clientX: number,
    public clientY: number,
    target: CanvasNode
  ) {
    super(type, { bubbles: true, cancelable: true });
    this.#target = target;
  }

  get x() {
    return this.clientX;
  }

  get y() {
    return this.clientY;
  }

  override get target() {
    return this.#target;
  }

  override get currentTarget() {
    return super.currentTarget as CanvasNode | null;
  }

  static fromMessage(
    message: ContextPointerEventMessage,
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
    message: ContextKeyboardEventMessage
  ) {
    super(type);
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
