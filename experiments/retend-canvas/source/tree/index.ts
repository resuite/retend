import {
  FontStyle,
  type FontStyleValue,
  FontWeight,
  type FontWeightValue,
  TextAlign,
  type TextAlignValue,
  WhiteSpace,
  type WhiteSpaceValue,
} from '../style';

export * from './node';
export * from './utils';
export * from './container';
export * from './text';
export * from './transform';

export class CanvasHost extends EventTarget {
  color = 'black';
  fontSize = 16;
  fontFamily = 'sans-serif';
  fontWeight: FontWeightValue = FontWeight.Normal;
  fontStyle: FontStyleValue = FontStyle.Normal;
  textAlign: TextAlignValue = TextAlign.Left;
  lineHeight: number | undefined;
  whiteSpace: WhiteSpaceValue = WhiteSpace.Normal;
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
