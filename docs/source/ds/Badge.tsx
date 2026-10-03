import type { JSX } from 'retend/jsx-runtime';

import { Badge as InnateBadge, type BadgeTone } from 'innate-ui';

type BadgeVariant = 'neutral' | 'accent' | 'good' | 'bad';

interface BadgeProps {
  variant?: BadgeVariant;
  children?: JSX.Template;
}

const TONE: Record<BadgeVariant, BadgeTone> = {
  neutral: 'neutral',
  accent: 'orange',
  good: 'green',
  bad: 'red',
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'border-line bg-sunken text-ink-soft',
  accent: 'border-accent/40 bg-accent-wash text-accent-ink',
  good: 'border-good/30 bg-good-wash text-good',
  bad: 'border-bad/30 bg-bad-wash text-bad',
};

/**
 * Docs badge. Innate UI owns the element, tone, and props. These classes
 * replace Innate's tones so the docs palette stays the only visual source.
 */
export function Badge(props: BadgeProps) {
  const { variant = 'neutral', children } = props;

  return (
    <InnateBadge
      tone={TONE[variant]}
      class={[
        'text-caption inline-flex items-center rounded-full border bg-none px-2 py-0.5 font-medium text-inherit',
        VARIANT_CLASSES[variant],
      ]}
    >
      {children}
    </InnateBadge>
  );
}
