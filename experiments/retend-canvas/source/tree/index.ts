import type { CanvasStyle } from '../types';

import {
  FontStyle,
  FontWeight,
  Length,
  PointerEvents,
  TextAlign,
  WhiteSpace,
} from '../style';

export * from './node';
export * from './utils';
export * from './container';
export * from './image';
export * from './text';
export * from './transform';
export * from './particles';

const CASCADED_PROPERTIES = [
  'color',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'fontWeight',
  'fontStyle',
  'textAlign',
  'whiteSpace',
  'pointerEvents',
] as const;

type TextStyling = {
  [K in (typeof CASCADED_PROPERTIES)[number]]: Array<
    NonNullable<CanvasStyle[K]>
  >;
};

export type CurrentCascade = {
  [key in keyof TextStyling]: TextStyling[key][number];
};

export class CanvasHost extends EventTarget {
  scopeWidth: number;
  scopeHeight: number;
  hitCtx: OffscreenCanvasRenderingContext2D;
  #cascade: TextStyling;

  constructor(
    public ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    super();
    const hitCanvas = new OffscreenCanvas(
      Math.round(width),
      Math.round(height)
    );
    const hitCtx = hitCanvas.getContext('2d', { willReadFrequently: true });
    if (!hitCtx) throw new Error('Could not create hit canvas context.');

    this.scopeWidth = width;
    this.scopeHeight = height;
    this.hitCtx = hitCtx;
    this.#cascade = {
      color: ['black'],
      fontSize: [Length.Px(16)],
      fontFamily: ['sans-serif'],
      fontWeight: [FontWeight.Normal],
      fontStyle: [FontStyle.Normal],
      lineHeight: [1.2],
      textAlign: [TextAlign.Left],
      whiteSpace: [WhiteSpace.Normal],
      pointerEvents: [PointerEvents.Auto],
    };
  }

  getAllCascadedValues(): CurrentCascade {
    const cascade = this.#cascade;
    return {
      color: cascade.color[cascade.color.length - 1],
      fontSize: cascade.fontSize[cascade.fontSize.length - 1],
      fontFamily: cascade.fontFamily[cascade.fontFamily.length - 1],
      fontWeight: cascade.fontWeight[cascade.fontWeight.length - 1],
      fontStyle: cascade.fontStyle[cascade.fontStyle.length - 1],
      lineHeight: cascade.lineHeight[cascade.lineHeight.length - 1],
      textAlign: cascade.textAlign[cascade.textAlign.length - 1],
      whiteSpace: cascade.whiteSpace[cascade.whiteSpace.length - 1],
      pointerEvents: cascade.pointerEvents[cascade.pointerEvents.length - 1],
    };
  }

  getCascadedValue<K extends keyof TextStyling>(key: K) {
    return this.#cascade[key][this.#cascade[key].length - 1];
  }

  setStyleState(style: CanvasStyle) {
    for (const key of CASCADED_PROPERTIES) {
      if (style[key]) this.#cascade[key].push(style[key] as never);
    }
  }

  unsetStyleState(style: CanvasStyle) {
    for (const key of CASCADED_PROPERTIES) {
      if (style[key]) this.#cascade[key].pop();
    }
  }
}
