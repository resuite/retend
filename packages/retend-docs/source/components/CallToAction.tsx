import { ArrowRightIcon, ExternalLinkIcon } from '@/icons';

import { Button } from './Button';
import { Card } from './Card';

export function CallToAction() {
  return (
    <section class="flex flex-col items-center py-8 text-center md:py-16">
      <span class="text-brand mb-4 font-mono text-xs tracking-widest uppercase md:mb-5">
        Get Started
      </span>
      <h2 class="text-fg mb-5 text-[1.6rem] leading-tight tracking-tight sm:text-[1.9rem] md:text-[2.2rem]">
        Start building today.
      </h2>
      <p class="text-fg-muted mb-10 max-w-130 text-base sm:text-lg">
        One command to scaffold a new project. TypeScript, routing, and dev
        server — all configured and ready.
      </p>

      <Card class="mb-10 inline-flex items-center gap-4 px-6 py-4 sm:px-8">
        <code class="text-fg font-mono text-sm sm:text-base">
          npx retend-start@latest
        </code>
      </Card>

      <div class="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <Button href="/docs" variant="primary">
          Read the Docs
          <ArrowRightIcon />
        </Button>
        <Button
          href="https://github.com/adebola-io/retend"
          variant="secondary"
          external
        >
          View on Github
          <ExternalLinkIcon />
        </Button>
      </div>
    </section>
  );
}
