import { For } from 'retend';

import { ThemePanel } from '@/ds/ThemePanel';

import { Section } from './Section';

interface TypeRow {
  token: string;
  spec: string;
  className: string;
  sample: string;
}

const ROWS: TypeRow[] = [
  {
    token: 'h1',
    spec: '28px / 1.2 / -0.02em',
    className: 'text-h1 font-semibold text-ink',
    sample: 'Control Flow',
  },
  {
    token: 'h2',
    spec: '20px / 1.3 / -0.015em',
    className: 'text-h2 font-semibold text-ink',
    sample: 'Conditional Rendering with If',
  },
  {
    token: 'h3',
    spec: '17px / 1.4 / -0.01em',
    className: 'text-h3 font-semibold text-ink',
    sample: 'Shorthand syntax',
  },
  {
    token: 'body',
    spec: '17px / 1.7, 68ch measure',
    className: 'max-w-[68ch] text-body text-ink',
    sample:
      'Use If, For, and Switch to render conditionals and lists. They read Cells and update the rendered output when their values change, without re-running the component.',
  },
  {
    token: 'small',
    spec: '14px / 1.55',
    className: 'text-small text-ink-soft',
    sample: 'Secondary text, table cells and callout bodies.',
  },
  {
    token: 'caption',
    spec: '12px / 1.4',
    className: 'text-caption text-ink-faint',
    sample: 'Labels, badges and metadata',
  },
  {
    token: 'code',
    spec: '12px / 1.65, mono',
    className: 'font-mono text-code text-ink',
    sample: 'const count = Cell.source(0);',
  },
];

export function TypeSection() {
  return (
    <Section
      id="type"
      title="Type scale"
      description="Headings now have real weight (600) and tighter tracking as they grow. Body text is system-ui. Code is Sajo Code."
    >
      <ThemePanel
        theme="light"
        class="border-line rounded-xl border p-5 sm:p-8"
      >
        <ul class="divide-line flex flex-col divide-y">
          {For(
            ROWS,
            (row) => (
              <li class="grid gap-2 py-6 first:pt-0 last:pb-0 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
                <div>
                  <p class="text-caption text-ink font-mono">
                    text-{row.token}
                  </p>
                  <p class="text-caption text-ink-faint font-mono">
                    {row.spec}
                  </p>
                </div>
                <p class={row.className}>{row.sample}</p>
              </li>
            ),
            { key: 'token' }
          )}
        </ul>
      </ThemePanel>
    </Section>
  );
}
