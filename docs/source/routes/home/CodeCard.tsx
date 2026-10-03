import type { JSX } from 'retend/jsx-runtime';

import { For } from 'retend';

import { highlightCode } from '@/utils/tsxHighlighter';

import type { ClassValue } from './constants';

interface CodeCardProps {
  code: string;
  filename: string;
  /** Dark cards force the dark token set, whatever the page theme. */
  tone?: 'light' | 'dark';
  /** 1-based line numbers to emphasise. */
  highlight?: JSX.ValueOrCell<number[]>;
  class?: ClassValue;
  /** Rendered in the title bar, after the filename. */
  meta?: JSX.Template;
  /** Rendered over the code, positioned in `em` units of the code text. */
  overlay?: JSX.Template;
  footer?: JSX.Template;
}

/** A window-style code card that floats on the painted panels. */
export function CodeCard(props: CodeCardProps) {
  const {
    code,
    filename,
    tone = 'light',
    highlight = [],
    class: className,
    meta,
    overlay,
    footer,
  } = props;
  const html = highlightCode(code.trim(), 'tsx');
  const theme = tone === 'dark' ? 'dark' : undefined;

  return (
    <figure
      data-ds-theme={theme}
      class={[
        'ds-code home-card border-line bg-raised text-ink min-w-0 overflow-hidden rounded-[14px] border',
        className,
      ]}
    >
      <figcaption class="border-line flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <span class="flex items-center gap-3">
          <span aria-hidden="true" class="flex gap-1.5">
            <span class="size-2.5 rounded-full bg-[#ed6a5e]" />
            <span class="size-2.5 rounded-full bg-[#f5bf4f]" />
            <span class="size-2.5 rounded-full bg-[#61c554]" />
          </span>
          <span class="text-caption text-ink-soft font-mono">{filename}</span>
        </span>
        {meta}
      </figcaption>
      <div class="relative overflow-x-auto py-4 text-[0.75rem]">
        {For(highlight, (line) => (
          <span
            aria-hidden="true"
            class="border-accent bg-accent-wash pointer-events-none absolute inset-x-0 border-l-2"
            style={{
              top: `calc(1rem + ${line - 1} * 1.7em)`,
              height: '1.7em',
            }}
          />
        ))}
        <pre class="relative px-4 font-mono leading-[1.7]">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
        {overlay}
      </div>
      {footer}
    </figure>
  );
}
