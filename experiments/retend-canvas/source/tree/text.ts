import {
  layoutWithLines,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

import type { CanvasRenderer } from '../canvas-renderer';

import { FontStyle, TextAlign, WhiteSpace } from '../style';
import { CanvasNode } from './node';

function getFont(host: CanvasRenderer['host']) {
  let fontStyle = 'normal';
  if (host.fontStyle === FontStyle.Italic) fontStyle = 'italic';
  else if (host.fontStyle === FontStyle.Oblique) fontStyle = 'oblique';
  return `${fontStyle} ${host.fontWeight} ${host.fontSize}px ${host.fontFamily}`;
}

export class CanvasText extends CanvasNode {
  #prepared: PreparedTextWithSegments | null = null;
  #preparedFont: string | null = null;
  #preparedText: string | null = null;
  #preparedWhiteSpace = -1;
  #layout: ReturnType<typeof layoutWithLines> | null = null;
  #layoutWidth = -1;
  #layoutLineHeight = -1;

  constructor(
    public content: string,
    renderer: CanvasRenderer
  ) {
    super(renderer);
  }

  override measure(maxWidth?: number) {
    const host = this.renderer.host;
    let content = this.content;
    const index = this.parent?.children.indexOf(this) ?? -1;
    if (index > 0 && this.parent?.children[index - 1] instanceof CanvasText) {
      return { width: 0, height: 0 };
    }
    if (index !== -1) {
      let nextIndex = index + 1;
      let next = this.parent?.children[nextIndex];
      while (next instanceof CanvasText) {
        content += next.content;
        nextIndex += 1;
        next = this.parent?.children[nextIndex];
      }
    }

    const font = host.ctx.font;
    host.ctx.font = getFont(host);
    const lineHeight = (host.lineHeight ?? 1.2) * host.fontSize;
    if (
      !this.#prepared ||
      this.#preparedFont !== host.ctx.font ||
      this.#preparedText !== content ||
      this.#preparedWhiteSpace !== host.whiteSpace
    ) {
      let whiteSpace: 'normal' | 'pre-wrap' = 'normal';
      if (host.whiteSpace === WhiteSpace.PreWrap) whiteSpace = 'pre-wrap';
      this.#prepared = prepareWithSegments(content, host.ctx.font, {
        whiteSpace,
      });
      this.#preparedFont = host.ctx.font;
      this.#preparedText = content;
      this.#preparedWhiteSpace = host.whiteSpace;
      this.#layout = null;
    }

    const prepared = this.#prepared;
    const maxLineWidth = maxWidth ?? Number.POSITIVE_INFINITY;
    if (
      !this.#layout ||
      this.#layoutWidth !== maxLineWidth ||
      this.#layoutLineHeight !== lineHeight
    ) {
      this.#layout = layoutWithLines(prepared, maxLineWidth, lineHeight);
      this.#layoutWidth = maxLineWidth;
      this.#layoutLineHeight = lineHeight;
    }
    const layout = this.#layout;
    let width = 0;
    for (const line of layout.lines) {
      if (line.width > width) width = line.width;
    }
    host.ctx.font = font;
    return { width, height: layout.height };
  }

  override draw(): void {
    const host = this.renderer.host;
    let content = this.content;
    const index = this.parent?.children.indexOf(this) ?? -1;
    if (index > 0 && this.parent?.children[index - 1] instanceof CanvasText) {
      return;
    }
    if (index !== -1) {
      let nextIndex = index + 1;
      let next = this.parent?.children[nextIndex];
      while (next instanceof CanvasText) {
        content += next.content;
        nextIndex += 1;
        next = this.parent?.children[nextIndex];
      }
    }

    host.ctx.textBaseline = 'top';
    const fillStyle = host.ctx.fillStyle;
    const font = host.ctx.font;
    host.ctx.fillStyle = host.color;
    host.ctx.font = getFont(host);
    const lineHeight = (host.lineHeight ?? 1.2) * host.fontSize;
    if (
      !this.#prepared ||
      this.#preparedFont !== host.ctx.font ||
      this.#preparedText !== content ||
      this.#preparedWhiteSpace !== host.whiteSpace
    ) {
      let whiteSpace: 'normal' | 'pre-wrap' = 'normal';
      if (host.whiteSpace === WhiteSpace.PreWrap) whiteSpace = 'pre-wrap';
      this.#prepared = prepareWithSegments(content, host.ctx.font, {
        whiteSpace,
      });
      this.#preparedFont = host.ctx.font;
      this.#preparedText = content;
      this.#preparedWhiteSpace = host.whiteSpace;
      this.#layout = null;
    }

    const prepared = this.#prepared;
    if (
      !this.#layout ||
      this.#layoutWidth !== host.scopeWidth ||
      this.#layoutLineHeight !== lineHeight
    ) {
      this.#layout = layoutWithLines(prepared, host.scopeWidth, lineHeight);
      this.#layoutWidth = host.scopeWidth;
      this.#layoutLineHeight = lineHeight;
    }
    const layout = this.#layout;
    let y = 0;
    for (const line of layout.lines) {
      let x = 0;
      if (host.textAlign === TextAlign.Center) {
        x = (host.scopeWidth - line.width) / 2;
      } else if (host.textAlign === TextAlign.Right) {
        x = host.scopeWidth - line.width;
      }
      host.ctx.fillText(line.text, x, y);
      y += lineHeight;
    }
    host.ctx.font = font;
    host.ctx.fillStyle = fillStyle;
  }
}
