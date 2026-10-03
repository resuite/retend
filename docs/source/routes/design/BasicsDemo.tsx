import { Badge } from '@/ds/Badge';
import { Callout } from '@/ds/Callout';
import { InlineCode } from '@/ds/InlineCode';
import { Kbd } from '@/ds/Kbd';
import { LinkCard } from '@/ds/LinkCard';

export function BasicsDemo() {
  return (
    <div class="flex flex-col gap-8">
      <div class="flex flex-wrap items-center gap-2">
        <Badge>Neutral</Badge>
        <Badge variant="accent">Experimental</Badge>
        <Badge variant="good">Stable</Badge>
        <Badge variant="bad">Removed</Badge>
      </div>

      <div class="flex flex-col gap-3">
        <Callout>
          <p>
            New projects include DevTools. The floating button opens the
            component tree and a live state inspector.
          </p>
        </Callout>
        <Callout variant="tip">
          <p>
            Pass <InlineCode>--tailwind</InlineCode> to include Tailwind CSS, or{' '}
            <InlineCode>--ssg</InlineCode> to enable static site generation.
          </p>
        </Callout>
        <Callout variant="warning" title="Early development">
          <p>Retend is not ready for production use yet.</p>
        </Callout>
        <Callout variant="danger">
          <p>
            Do not call <InlineCode>set</InlineCode> inside{' '}
            <InlineCode>Cell.derived</InlineCode>. Derived cells must be pure.
          </p>
        </Callout>
      </div>

      <p class="text-body text-ink-soft">
        Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> to search the docs.
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <LinkCard
          href="/docs/getting-started"
          title="Getting Started"
          description="Scaffold a project and run it."
        />
        <LinkCard
          href="/docs/control-flow"
          title="Control Flow"
          description="Render conditionals and lists."
        />
      </div>
    </div>
  );
}
