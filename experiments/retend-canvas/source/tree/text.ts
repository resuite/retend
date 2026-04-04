import {
  layoutWithLines,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

import type { CanvasHost } from '.';

import { CanvasNode } from './node';

export class CanvasText extends CanvasNode {
  #prepared: PreparedTextWithSegments | null = null;
  #preparedFont: string | null = null;
  #preparedText: string | null = null;
  #preparedWhiteSpace: 'normal' | 'pre-wrap' | null = null;

  constructor(public content: string) {
    super();
  }

  #prepare(font: string, whiteSpace: 'normal' | 'pre-wrap') {
    if (
      this.#prepared &&
      this.#preparedFont === font &&
      this.#preparedText === this.content &&
      this.#preparedWhiteSpace === whiteSpace
    ) {
      return this.#prepared;
    }

    this.#prepared = prepareWithSegments(this.content, font, { whiteSpace });
    this.#preparedFont = font;
    this.#preparedText = this.content;
    this.#preparedWhiteSpace = whiteSpace;
    return this.#prepared;
  }

  override draw(host: CanvasHost): void {
    host.ctx.textBaseline = 'top';
    const fillStyle = host.ctx.fillStyle;
    const font = host.ctx.font;
    host.ctx.fillStyle = host.color;
    host.ctx.font = `${host.fontSize}px sans-serif`;
    const lineHeight = host.lineHeight ?? host.fontSize * 1.2;
    const prepared = this.#prepare(host.ctx.font, host.whiteSpace);
    const layout = layoutWithLines(prepared, host.scopeWidth, lineHeight);
    let y = 0;
    for (const line of layout.lines) {
      let x = 0;
      if (host.textAlign === 'center') {
        x = (host.scopeWidth - line.width) / 2;
      } else if (host.textAlign === 'right') {
        x = host.scopeWidth - line.width;
      }
      host.ctx.fillText(line.text, x, y);
      y += lineHeight;
    }
    host.ctx.font = font;
    host.ctx.fillStyle = fillStyle;
  }
}
