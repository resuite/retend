import { GithubIcon } from '@/icons';

import { CREATE_COMMAND, FRAME_PAD, GITHUB_URL } from './constants';
import { CopyCommand } from './CopyCommand';
import { PaintingPanel } from './Painting';
import { paintings } from './paintings';
import { PillLink } from './PillLink';

export function StartSection() {
  return (
    <section
      aria-labelledby="home-start-title"
      class={['border-line border-t py-20 md:py-28', FRAME_PAD]}
    >
      <PaintingPanel
        painting={paintings.octoberDay}
        class="flex flex-col items-center px-5 pt-20 sm:px-10 md:h-[44rem] md:pt-24"
        imageClass="object-[50%_30%]"
      >
        <div
          aria-hidden="true"
          class="absolute inset-x-0 top-0 -z-10 h-2/3 bg-linear-to-b from-white/45 to-transparent"
        />
        <h2
          id="home-start-title"
          class="text-center text-[clamp(2.25rem,3.8vw,3rem)] leading-[1.08] font-normal tracking-[-0.03em] text-[#1c1917]"
        >
          Make something cool.
        </h2>
        <CopyCommand command={CREATE_COMMAND} class="mt-8 w-full max-w-md" />
        <div class="mt-5 flex flex-wrap justify-center gap-2.5">
          <PillLink href="/docs/getting-started">Read the docs</PillLink>
          <PillLink href={GITHUB_URL} variant="glass" external>
            <GithubIcon />
            View on GitHub
          </PillLink>
        </div>

        <Terminal />
      </PaintingPanel>
    </section>
  );
}

/** The scaffold's first prompt, rising from the bottom of the painting. */
function Terminal() {
  return (
    <div
      aria-hidden="true"
      data-ds-theme="dark"
      class="home-card border-line bg-raised text-ink mt-14 w-full max-w-xl overflow-hidden rounded-t-[14px] border border-b-0 font-mono text-[0.75rem] leading-[1.8] md:absolute md:bottom-0 md:left-1/2 md:mt-0 md:-translate-x-1/2"
    >
      <div class="border-line flex items-center gap-1.5 border-b px-4 py-2.5">
        <span class="size-2.5 rounded-full bg-[#ed6a5e]" />
        <span class="size-2.5 rounded-full bg-[#f5bf4f]" />
        <span class="size-2.5 rounded-full bg-[#61c554]" />
      </div>
      <div class="px-5 pt-4 pb-8">
        <p>
          <span class="text-ink-faint">~/projects</span> {CREATE_COMMAND}
        </p>
        <p class="mt-2">
          <span class="text-good">?</span> Which platform are you targeting?
        </p>
        <p class="text-accent-ink">{'❯'} Web (DOM + Vite)</p>
        <p class="text-ink-soft pl-[2ch]">Native Desktop (GPUI)</p>
      </div>
    </div>
  );
}
