import { For } from 'retend';

import type { Feature } from './features';

import { CodeCard } from './CodeCard';
import { PillLink } from './PillLink';

interface FeatureProps {
  feature: Feature;
}

/** What the painting shows for one feature: its code and what it covers. */
export function FeaturePanel(props: FeatureProps) {
  const { feature } = props;

  return (
    <div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-5">
      <CodeCard
        code={feature.code}
        filename={feature.filename}
        class="w-full"
      />
      <ul class="flex flex-wrap justify-center gap-2" aria-label="Covers">
        {For(feature.tags, (tag) => (
          <li class="text-caption rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[#1c1917] backdrop-blur-md dark:border-white/10 dark:bg-[#1c1917]/85 dark:text-white">
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The caption under the panel: what the feature is, and where to read on. */
export function FeatureCaption(props: FeatureProps) {
  const { feature } = props;

  return (
    <div class="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div class="max-w-xl">
        <h3 class="text-ink text-[1.1875rem] tracking-[-0.01em]">
          {feature.title}
        </h3>
        <p class="text-body text-ink-faint mt-1.5">{feature.body}</p>
      </div>
      <PillLink href={feature.href} class="shrink-0">
        {feature.linkLabel}
      </PillLink>
    </div>
  );
}
