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
  return (
    <Card class="group hover:border-brand/40 flex min-w-0 flex-col overflow-hidden transition-colors">
      <div class="border-border/65 dark:border-border bg-surface-alt/30 group-hover:bg-brand/[0.02] relative flex h-48 w-full items-center justify-center overflow-hidden border-b transition-colors">
        <props.illustration />
      </div>
      <div class="flex-1 p-6 md:p-8">
        <FeatureCard title={props.title} description={props.description} />
      </div>
    </Card>
  );
}

export function Ecosystem() {
  return (
    <section>
      <div class="animate-scroll-fade-in">
        <SectionHeader
          label="Ecosystem"
          title="Everything you need."
          description="Retend ships with a full suite of tools so you can focus on your product, not your dependency list."
        />
      </div>

      <ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
        <li class="animate-scroll-reveal" style={{ 'animation-delay': '0ms' }}>
          <EcosystemCard
            title="Built-in Router"
            description="First-class routing with lazy loading, middleware, route locking, and reactive query params. No external dependencies required."
            illustration={RouterIllustration}
          />
        </li>

        <li class="animate-scroll-reveal" style={{ 'animation-delay': '100ms' }}>
          <EcosystemCard
            title="Server Rendering"
            description="SSR and static site generation out of the box. The same components render on the server and hydrate seamlessly on the client."
            illustration={SsrIllustration}
          />
        </li>

        <li class="animate-scroll-reveal" style={{ 'animation-delay': '200ms' }}>
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

        <li class="animate-scroll-reveal" style={{ 'animation-delay': '0ms' }}>
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

        <li class="animate-scroll-reveal" style={{ 'animation-delay': '100ms' }}>
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

        <li class="animate-scroll-reveal" style={{ 'animation-delay': '200ms' }}>
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
