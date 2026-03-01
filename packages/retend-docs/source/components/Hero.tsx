import { ArrowRightIcon, ExternalLinkIcon } from '@/icons';

import { CodeBlock } from './CodeBlock';
import { Button } from './Button';

const heroCode = `import { Cell } from "retend";

function Counter() {
  const count = Cell.source(0);
  const increment = () => count.set(count.get() + 1);

  return (
    <button type="button" onClick={increment}>
      Count is {count}
    </button>
  );
}`;

export function Hero() {
  return (
    <section class="grid grid-cols-1 items-center gap-10 py-8 sm:gap-12 md:grid-cols-[1.1fr_0.9fr] md:gap-20 md:py-20">
      <div>
        <h1 class="text-fg mb-5 text-[2rem] leading-tight tracking-tight sm:text-[2.4rem] md:text-[2.6rem]">
          The framework for
          <br />
          fluid user interfaces.
        </h1>
        <p class="text-fg-muted text-base sm:text-lg">
          Retend is a toolkit for creating interactive applications and user
          interfaces. It manages complex application logic, allowing you to
          build fast, smooth sites declaratively.
        </p>

        <div class="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:gap-6">
          <Button href="/quickstart" variant="primary">
            Get Started
            <ArrowRightIcon />
          </Button>
          <Button
            href="https://github.com/adebola-io/retend"
            variant="secondary"
            external
          >
            View Github
            <ExternalLinkIcon />
          </Button>
        </div>
      </div>

      <CodeBlock code={heroCode} lang="tsx" />
    </section>
  );
}
