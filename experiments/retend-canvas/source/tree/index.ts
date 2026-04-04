export * from './node';
export * from './utils';
export * from './container';
export * from './text';
export * from './transform';

export class CanvasHost extends EventTarget {
  color = 'black';
  fontSize = 16;
  textAlign: 'left' | 'center' | 'right' = 'left';
  lineHeight: number | undefined;
  whiteSpace: 'normal' | 'pre-wrap' = 'normal';
  scopeWidth: number;
  scopeHeight: number;

  constructor(
    public ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    super();
    this.scopeWidth = width;
    this.scopeHeight = height;
  }
}
