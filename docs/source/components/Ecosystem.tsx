import type { JSX } from 'retend/jsx-runtime';

import { Card } from './Card';
import {
  AwaitIllustration,
  HmrIllustration,
  RouterIllustration,
  ScopedContextIllustration,
  SsrIllustration,
  UniversalRenderingIllustration,
} from './EcosystemIllustrations';
import { FeatureCard } from './FeatureCard';
import { SectionHeader } from './SectionHeader';

function EcosystemCard(props: {
  title: string;
  description: string | JSX.Element;
  illustration: () => JSX.Element;
}) {
  const { title, description, illustration: Illustration } = props;

  return (
    <Card class="group hover:border-brand/40 flex min-w-0 flex-col overflow-hidden transition-colors">
      <div class="border-border/65 dark:border-border bg-surface-alt/30 group-hover:bg-brand/2 relative flex h-48 w-full items-center justify-center overflow-hidden border-b transition-colors">
        <Illustration />
      </div>
      <div class="flex-1 p-6 md:p-8">
        <FeatureCard title={title} description={description} />
      </div>
    </Card>
  );
}

export function Ecosystem() {
  return (
    <section>
      <div>
        <SectionHeader
          label="Ecosystem"
          title="Everything you need."
          description="Retend ships with a full suite of tools so you can focus on your product, not your dependency list."
        />
      </div>

      <ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
        <li>
          <EcosystemCard
            title="Built-in Router"
            description="First-class routing with lazy loading, middleware, route locking, and reactive query params. No external dependencies required."
            illustration={RouterIllustration}
          />
        </li>

        <li>
          <EcosystemCard
            title="Server Rendering"
            description="SSR and static site generation out of the box. The same components render on the server and hydrate seamlessly on the client."
            illustration={SsrIllustration}
          />
        </li>

        <li>
          <EcosystemCard
            title="Async Boundaries"
            description={
              <>
                Coordinate loading states across component trees with{' '}
                <code class="text-fg font-mono text-xs">{'<Await>'}</code>.
                Nested async data resolves together, eliminating layout shift.
              </>
            }
            illustration={AwaitIllustration}
          />
        </li>

        <li>
          <EcosystemCard
            title="Instant HMR"
            description={
              <>
                Experience lightning-fast Hot Module Replacement. State is
                preserved across updates so you never lose your place while
                iterating on complex UIs.
              </>
            }
            illustration={HmrIllustration}
          />
        </li>

        <li>
          <EcosystemCard
            title="Scoped Context"
            description={
              <>
                Type-safe dependency injection scoped to component subtrees.
                Create isolated contexts that automatically clean up, with no
                prop drilling or global singletons required.
              </>
            }
            illustration={ScopedContextIllustration}
          />
        </li>

        <li>
          <EcosystemCard
            title="Universal Rendering"
            description="Write components once and render them anywhere. The same code runs in the browser, on the server, or in tests — powered by a pluggable renderer architecture."
            illustration={UniversalRenderingIllustration}
          />
        </li>
      </ul>
    </section>
  );
}
