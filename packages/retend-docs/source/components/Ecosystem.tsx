import type { JSX } from 'retend/jsx-runtime';

import { Card } from './Card';
import { FeatureCard } from './FeatureCard';
import { SectionHeader } from './SectionHeader';
import {
  AwaitIllustration,
  HmrIllustration,
  MicrofrontendIllustration,
  RouterIllustration,
  SsrIllustration,
  TypeSafetyIllustration,
} from './EcosystemIllustrations';

function EcosystemCard(props: {
  title: string;
  description: string | JSX.Element;
  illustration: () => JSX.Element;
}) {
  return (
    <Card class="group flex flex-col overflow-hidden transition-colors hover:border-brand/40">
      <div class="relative flex h-48 w-full items-center justify-center overflow-hidden border-b border-border bg-surface-alt/30 transition-colors group-hover:bg-brand/[0.02]">
        <props.illustration />
      </div>
      <div class="flex-1 p-6 md:p-8">
        <FeatureCard
          title={props.title}
          description={props.description}
        />
      </div>
    </Card>
  );
}

export function Ecosystem() {
  return (
    <section>
      <SectionHeader
        label="Ecosystem"
        title="Everything you need."
        description="Retend ships with a full suite of tools so you can focus on your product, not your dependency list."
      />

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
        <EcosystemCard
          title="Built-in Router"
          description="First-class routing with lazy loading, middleware, route locking, and reactive query params. No external dependencies required."
          illustration={RouterIllustration}
        />

        <EcosystemCard
          title="Server Rendering"
          description="SSR and static site generation out of the box. The same components render on the server and hydrate seamlessly on the client."
          illustration={SsrIllustration}
        />

        <EcosystemCard
          title="Async Boundaries"
          description={
            <>
              Coordinate loading states across component trees with{' '}
              <code class="text-fg font-mono text-xs">{'<Await>'}</code>. Nested
              async data resolves together, eliminating layout shift.
            </>
          }
          illustration={AwaitIllustration}
        />

        <EcosystemCard
          title="Instant HMR"
          description={
            <>
              Experience lightning-fast Hot Module Replacement.
              State is preserved across updates so you never lose
              your place while iterating on complex UIs.
            </>
          }
          illustration={HmrIllustration}
        />

        <EcosystemCard
          title="Microfrontends"
          description={
            <>
              Deploy independent Retend applications and stitch them
              together at runtime. True architectural decoupling powered
              by Webpack Module Federation and zero-cost hydration.
            </>
          }
          illustration={MicrofrontendIllustration}
        />

        <EcosystemCard
          title="Strictly Typed"
          description="Built entirely in TypeScript. Enjoy end-to-end type safety across components, context boundaries, router parameters, and API responses."
          illustration={TypeSafetyIllustration}
        />
      </div>
    </section>
  );
}
