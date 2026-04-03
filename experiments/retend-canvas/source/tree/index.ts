export * from './node';
export * from './utils';
export * from './container';

export class CanvasHost extends EventTarget {
  constructor(public ctx: CanvasRenderingContext2D) {
    super();
  }
}
