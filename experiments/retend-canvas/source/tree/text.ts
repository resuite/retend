import {
  layoutWithLines,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

import type { CanvasHost } from '.';

import { CanvasNode } from './node';

function getFont(host: CanvasHost) {
  return `${host.fontStyle} ${host.fontWeight} ${host.fontSize}px ${host.fontFamily}`;
}

export class CanvasText extends CanvasNode {
  #prepared: PreparedTextWithSegments | null = null;
  #preparedFont: string | null = null;
  #preparedText: string | null = null;
  #preparedWhiteSpace: 'normal' | 'pre-wrap' | null = null;

  constructor(public content: string) {
    super();
  }

  override draw(host: CanvasHost): void {
    host.ctx.textBaseline = 'top';
    const fillStyle = host.ctx.fillStyle;
    const font = host.ctx.font;
    host.ctx.fillStyle = host.color;
    host.ctx.font = getFont(host);
    const lineHeight = host.lineHeight ?? host.fontSize * 1.2;
    if (
      !this.#prepared ||
      this.#preparedFont !== host.ctx.font ||
      this.#preparedText !== this.content ||
      this.#preparedWhiteSpace !== host.whiteSpace
    ) {
      this.#prepared = prepareWithSegments(this.content, host.ctx.font, {
        whiteSpace: host.whiteSpace,
      });
      this.#preparedFont = host.ctx.font;
      this.#preparedText = this.content;
      this.#preparedWhiteSpace = host.whiteSpace;
    }

    const prepared = this.#prepared;
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
