import { ArrowRightIcon, ExternalLinkIcon } from '@/icons';
import { Link } from 'retend/router';
import { CodeBlock } from './CodeBlock';

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
    <section class="grid grid-cols-1 items-center gap-15 py-10 md:grid-cols-[1.1fr_0.9fr] md:gap-20 md:py-20">
      <div>
        <h1 class="text-fg mb-6 text-[2.5rem] leading-tight tracking-tight">
          The framework for
          <br />
          fluid user interfaces.
        </h1>
        <p class="text-fg-muted text-lg">
          Retend is a toolkit for creating interactive applications and user
          interfaces. It manages complex application logic, allowing you to
          build fast, smooth sites declaratively.
        </p>

        <div class="mt-12 flex gap-6">
          <Link
            href="/quickstart"
            class="bg-brand hover:bg-brand-dark inline-flex items-center gap-2.5 rounded-lg px-7 py-3 text-white transition-all hover:-translate-y-0.5"
          >
            Get Started
            <ArrowRightIcon />
          </Link>
          <a
            href="https://github.com/adebola-io/retend"
            class="border-surface-alt bg-surface-alt text-fg hover:bg-surface-alt-hover hover:border-surface-alt-hover inline-flex items-center gap-2.5 rounded-lg border px-7 py-3 transition-all"
            target="_blank"
            rel="noreferrer"
          >
            View Github
            <ExternalLinkIcon />
          </a>
        </div>
      </div>

      <CodeBlock code={heroCode} lang="tsx" />
    </section>
  );
}
