import type { JSX } from 'retend/jsx-runtime';

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
  #styleCtx: Array<{
    color: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: FontWeightValue;
    fontStyle: FontStyleValue;
    textAlign: TextAlignValue;
    lineHeight: number | undefined;
    whiteSpace: WhiteSpaceValue;
  }>;
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
    this.#styleCtx = [
      {
        color: this.color,
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
        textAlign: this.textAlign,
        lineHeight: this.lineHeight,
        whiteSpace: this.whiteSpace,
      },
    ];
  }

  pushStyleCtx(style: JSX.Style) {
    const current = this.#styleCtx[this.#styleCtx.length - 1];
    const next = {
      color: style.color ?? current.color,
      fontSize: style.fontSize?.value ?? current.fontSize,
      fontFamily: style.fontFamily ?? current.fontFamily,
      fontWeight: style.fontWeight ?? current.fontWeight,
      fontStyle: style.fontStyle ?? current.fontStyle,
      textAlign: style.textAlign ?? current.textAlign,
      lineHeight: style.lineHeight ?? current.lineHeight,
      whiteSpace: style.whiteSpace ?? current.whiteSpace,
    };
    this.#styleCtx.push(next);
    this.color = next.color;
    this.fontSize = next.fontSize;
    this.fontFamily = next.fontFamily;
    this.fontWeight = next.fontWeight;
    this.fontStyle = next.fontStyle;
    this.textAlign = next.textAlign;
    this.lineHeight = next.lineHeight;
    this.whiteSpace = next.whiteSpace;
  }

  popStyleCtx() {
    if (this.#styleCtx.length === 1) return;
    this.#styleCtx.pop();
    const current = this.#styleCtx[this.#styleCtx.length - 1];
    this.color = current.color;
    this.fontSize = current.fontSize;
    this.fontFamily = current.fontFamily;
    this.fontWeight = current.fontWeight;
    this.fontStyle = current.fontStyle;
    this.textAlign = current.textAlign;
    this.lineHeight = current.lineHeight;
    this.whiteSpace = current.whiteSpace;
  }
}
