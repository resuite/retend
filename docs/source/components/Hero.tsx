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
        <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-500">
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Not yet ready for production use
        </div>
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
