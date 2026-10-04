import { Link } from 'retend/router';

import { InlineCode } from '@/components/InlineCode';
import { Callout } from '@/ds/Callout';
import { CodeFrame } from '@/ds/CodeFrame';
import { ThemePair } from '@/ds/ThemePair';

import { IF_SAMPLE } from './samples';
import { Section } from './Section';
import { ShellNav } from './ShellNav';
import { ShellRail, ShellTopBar } from './ShellRail';

function ShellSample() {
  return (
    <div class="border-line bg-paper overflow-hidden rounded-lg border">
      <ShellTopBar />
      <div class="grid grid-cols-1 gap-10 px-5 py-10 md:grid-cols-[220px_minmax(0,1fr)] md:px-8 xl:grid-cols-[240px_minmax(0,720px)_220px] xl:justify-center">
        <ShellNav />
        <article class="flex min-w-0 flex-col gap-5">
          <h1 class="text-h1 text-ink font-semibold">Control Flow</h1>
          <p class="text-body text-ink-soft">
            Use the <InlineCode>If</InlineCode>, <InlineCode>For</InlineCode>,
            and <InlineCode>Switch</InlineCode> functions to render conditionals
            and lists. They can read Cells and update the rendered output when
            their values change.
          </p>
          <h2 class="text-h2 text-ink mt-6 font-semibold">
            Conditional Rendering with If
          </h2>
          <p class="text-body text-ink">
            Use <InlineCode>If</InlineCode> to show or hide interface content
            based on a condition. It takes a Cell, or any regular value, and
            branches on whether the value is true or false. See{' '}
            <Link
              href="/docs/lifecycle-hooks"
              class="text-accent-ink decoration-accent/40 hover:decoration-accent underline underline-offset-2"
            >
              lifecycle hooks
            </Link>{' '}
            for running code when elements connect.
          </p>
          <CodeFrame
            filename="ToggleMessage.tsx"
            lang="tsx"
            code={IF_SAMPLE}
            highlight={[13, 14, 15]}
          />
          <Callout variant="warning" title="Plain JavaScript does not react">
            <p>
              Standard <InlineCode>if</InlineCode> statements and{' '}
              <InlineCode>&&</InlineCode> do not connect to Retend's reactivity
              system. Use <InlineCode>If</InlineCode> for content that can
              change.
            </p>
          </Callout>
        </article>
        <ShellRail />
      </div>
    </div>
  );
}

export function ShellSection() {
  return (
    <Section
      id="shell"
      title="Page shell"
      description="A docs page at the proposed proportions: 240px nav, 720px article, 220px rail. The nav hides below 768px and the rail below 1280px. Content is the real Control Flow page, so hierarchy is judged on actual text."
    >
      <ThemePair layout="stack" render={() => <ShellSample />} />
    </Section>
  );
}
