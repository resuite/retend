import { ArrowRightIcon, ExternalLinkIcon } from '@/icons';

import { Button } from './Button';
import { CodeBlock } from './CodeBlock';

const heroCode = `function ToggleSwitch() {
  const isOn = Cell.source(false);
  const toggle = () => isOn.set(!isOn.get());

  return (
    <div>
      <h2>Switch status: {isOn}</h2>
      <button type="button" onClick={toggle}>Toggle</button>
    </div>
  );
}`;

export function Hero() {
  return (
    <section class="grid grid-cols-1 items-center gap-10 py-8 sm:gap-12 md:grid-cols-[0.8fr_1fr] md:gap-20 md:py-20">
      <div class="min-w-0">
        <h1 class="text-fg mb-5 text-[2rem] leading-tight tracking-tight sm:text-[2.4rem] md:text-[2.6rem]">
          A simpler way to build
          <br />
          user interfaces.
        </h1>
        <p class="text-fg-muted text-base text-pretty sm:text-lg">
          Retend is a framework for creating interactive applications and user
          interfaces. It manages complex application logic, allowing you to
          build fast, smooth sites declaratively.
        </p>

        <div class="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:gap-6">
          <Button href="/docs" variant="primary">
            Get Started
            <ArrowRightIcon />
          </Button>
          <Button
            href="https://github.com/resuite/retend"
            variant="secondary"
            external
          >
            View GitHub
            <ExternalLinkIcon />
          </Button>
        </div>
      </div>

      <CodeBlock code={heroCode} lang="tsx" class="min-w-0" />
    </section>
  );
}
