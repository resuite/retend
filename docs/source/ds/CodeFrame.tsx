import { Cell, For, If } from 'retend';

import { highlightCode } from '@/utils/tsxHighlighter';

interface CodeFrameProps {
  code: string;
  lang: string;
  filename?: string;
  /** 1-based line numbers to emphasize. */
  highlight?: number[];
  /** Drops the border and radius, for use inside Tabs. */
  bare?: boolean;
}

/**
 * Highlighted code with an optional filename bar, line emphasis and copy.
 * Line emphasis is a positioned band behind the text (1.65em per line), so it
 * does not depend on how the highlighter splits tokens across lines.
 */
export function CodeFrame(props: CodeFrameProps) {
  const { code, lang, filename, highlight = [], bare = false } = props;
  const copied = Cell.source(false);
  const copyLabel = Cell.derived(() => (copied.get() ? 'Copied' : 'Copy'));
  const html = highlightCode(code.trimEnd(), lang);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
    copied.set(true);
    setTimeout(() => copied.set(false), 1600);
  };

  return (
    <figure
      class={[
        'ds-code bg-sunken min-w-0 overflow-hidden',
        { 'border-line rounded-lg border': !bare },
      ]}
    >
      {If(filename, (name) => (
        <figcaption class="border-line text-caption text-ink-soft border-b px-4 py-2 font-mono">
          {name}
        </figcaption>
      ))}
      <div class="relative">
        <button
          type="button"
          onClick={handleCopy}
          class="border-line bg-raised text-caption text-ink-soft hover:text-ink focus-visible:outline-accent absolute top-2 right-2 z-10 rounded-md border px-2 py-1 font-medium focus-visible:outline-2"
        >
          <span aria-live="polite">{copyLabel}</span>
        </button>
        <div
          tabIndex={0}
          class="text-code focus-visible:outline-accent relative overflow-x-auto py-4 focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          {For(highlight, (line) => (
            <span
              aria-hidden="true"
              class="border-accent bg-accent-wash pointer-events-none absolute inset-x-0 border-l-2"
              style={{
                top: `calc(1rem + ${line - 1} * 1.65em)`,
                height: '1.65em',
              }}
            />
          ))}
          <pre class="relative px-4 font-mono leading-[1.65]">
            <code dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </div>
      </div>
    </figure>
  );
}
