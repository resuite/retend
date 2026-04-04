import {
  layoutWithLines,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

import type { CanvasHost } from '.';

import { TextAlign } from '../style';
import { CanvasNode } from './node';

function getFont(host: CanvasHost) {
  let fontStyle = 'normal';
  if (host.fontStyle.value === 1) fontStyle = 'italic';
  else if (host.fontStyle.value === 2) fontStyle = 'oblique';
  return `${fontStyle} ${host.fontWeight} ${host.fontSize}px ${host.fontFamily}`;
}

export class CanvasText extends CanvasNode {
  #prepared: PreparedTextWithSegments | null = null;
  #preparedFont: string | null = null;
  #preparedText: string | null = null;
  #preparedWhiteSpace = -1;

  constructor(public content: string) {
    super();
  }

  override draw(host: CanvasHost): void {
    host.ctx.textBaseline = 'top';
    const fillStyle = host.ctx.fillStyle;
    const font = host.ctx.font;
    host.ctx.fillStyle = host.color;
    host.ctx.font = getFont(host);
    const lineHeight = (host.lineHeight ?? 1.2) * host.fontSize;
    if (
      !this.#prepared ||
      this.#preparedFont !== host.ctx.font ||
      this.#preparedText !== this.content ||
      this.#preparedWhiteSpace !== host.whiteSpace.value
    ) {
      let whiteSpace: 'normal' | 'pre-wrap' = 'normal';
      if (host.whiteSpace.value === 1) whiteSpace = 'pre-wrap';
      this.#prepared = prepareWithSegments(this.content, host.ctx.font, {
        whiteSpace,
      });
      this.#preparedFont = host.ctx.font;
      this.#preparedText = this.content;
      this.#preparedWhiteSpace = host.whiteSpace.value;
    }

    const prepared = this.#prepared;
    const layout = layoutWithLines(prepared, host.scopeWidth, lineHeight);
    let y = 0;
    for (const line of layout.lines) {
      let x = 0;
      if (host.textAlign.value === TextAlign.Center.value) {
        x = (host.scopeWidth - line.width) / 2;
      } else if (host.textAlign.value === TextAlign.Right.value) {
        x = host.scopeWidth - line.width;
      }
      host.ctx.fillText(line.text, x, y);
      y += lineHeight;
    }
    host.ctx.font = font;
    host.ctx.fillStyle = fillStyle;
  }
}
