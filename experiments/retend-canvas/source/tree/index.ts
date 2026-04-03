export * from './node';
export * from './utils';
export * from './container';
export * from './text';

export class CanvasHost extends EventTarget {
  textColor = 'black';

  constructor(public ctx: CanvasRenderingContext2D) {
    super();
  }
}
