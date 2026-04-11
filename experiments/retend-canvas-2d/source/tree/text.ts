import {
  layoutWithLines,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

import type { CurrentCascade } from '.';
import type { CanvasRenderer } from '../canvas-renderer';
import type { FrameBuilder } from '../frame-builder';

import { FontStyle, TextAlign, WhiteSpace } from '../style';
import { CanvasNode } from './node';

function getFont(styles: CurrentCascade) {
  const fontStyle =
    styles.fontStyle === FontStyle.Italic
      ? 'italic'
      : styles.fontStyle === FontStyle.Oblique
        ? 'oblique'
        : 'normal';
  return `${fontStyle} ${styles.fontWeight} ${styles.fontSize!.value}px ${styles.fontFamily}`;
}

export class CanvasText extends CanvasNode {
  #content: string;
  #cachedFullText: string | null = null;
  #cachedFullTextVersion = -1;
  #prepared: PreparedTextWithSegments | null = null;
  #preparedFont: string | null = null;
  #preparedText: string | null = null;
  #preparedWhiteSpace = -1;
  #layout: ReturnType<typeof layoutWithLines> | null = null;
  #layoutWidth = -1;
  #layoutLineHeight = -1;

  constructor(content: string, renderer: CanvasRenderer) {
    super(renderer);
    this.#content = content;
  }

  get content() {
    return this.#content;
  }

  set content(content: string) {
    this.#content = content;
    if (this.parent) this.parent.textVersion += 1;
  }

  get fullText() {
    const textVersion = this.parent?.textVersion ?? -1;
    if (
      this.#cachedFullText !== null &&
      this.#cachedFullTextVersion === textVersion
    )
      return this.#cachedFullText;
    let content = this.content;
    const index = this.parent?.children.indexOf(this) ?? -1;
    if (index !== -1) {
      let nextIndex = index + 1;
      let next = this.parent?.children[nextIndex];
      while (next instanceof CanvasText) {
        content += next.content;
        nextIndex += 1;
        next = this.parent?.children[nextIndex];
      }
    }
    this.#cachedFullText = content;
    this.#cachedFullTextVersion = textVersion;
    return content;
  }

  override measure(maxWidth?: number) {
    const host = this.renderer.host;
    const textStyles = host.getAllCascadedValues();
    if (!this.isLeadingText()) return { width: 0, height: 0 };
    const content = this.fullText;

    const font = host.ctx.font;
    host.ctx.font = getFont(textStyles);
    const lineHeight = textStyles.lineHeight * textStyles.fontSize.value;
    if (
      !this.#prepared ||
      this.#preparedFont !== host.ctx.font ||
      this.#preparedText !== content ||
      this.#preparedWhiteSpace !== textStyles.whiteSpace
    ) {
      const whiteSpace =
        textStyles.whiteSpace === WhiteSpace.PreWrap
          ? ('pre-wrap' as const)
          : ('normal' as const);
      this.#prepared = prepareWithSegments(content, host.ctx.font, {
        whiteSpace,
      });
      this.#preparedFont = host.ctx.font;
      this.#preparedText = content;
      this.#preparedWhiteSpace = textStyles.whiteSpace!;
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
    let width = 0;
    for (const line of this.#layout.lines) {
      if (line.width > width) width = line.width;
    }
    host.ctx.font = font;
    return { width, height: this.#layout.height };
  }

  private isLeadingText(): boolean {
    const index = this.parent?.children.indexOf(this) ?? -1;
    return (
      index < 1 || !(this.parent?.children[index - 1] instanceof CanvasText)
    );
  }

  override layout(): void {
    if (!this.isLeadingText()) return;
    this.measure(this.renderer.host.scopeWidth);
  }

  override emit(frame: FrameBuilder): void {
    if (!this.isLeadingText()) return;
    const layout = this.#layout;
    if (!layout) throw new Error('emit called before layout.');
    const host = this.renderer.host;
    const textStyles = host.getAllCascadedValues();
    const font = getFont(textStyles);
    let y = 0;
    for (const line of layout.lines) {
      const x =
        textStyles.textAlign === TextAlign.Center
          ? (host.scopeWidth - line.width) / 2
          : textStyles.textAlign === TextAlign.Right
            ? host.scopeWidth - line.width
            : 0;
      frame.pushTextLine(
        { text: line.text, x, y, font, fillStyle: textStyles.color },
        this.id
      );
      y += this.#layoutLineHeight;
    }
  }
}
