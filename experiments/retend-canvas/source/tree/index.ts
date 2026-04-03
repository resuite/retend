export * from './node';
export * from './utils';
export * from './container';
export * from './text';

export class CanvasHost extends EventTarget {
  color = 'black';
  fontSize = 16;
  scopeWidth: number;
  scopeHeight: number;

  constructor(
    public ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    super();
    this.scopeWidth = width;
    this.scopeHeight = height;
  }
}
