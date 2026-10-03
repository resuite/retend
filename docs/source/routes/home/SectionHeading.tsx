import type { ClassValue } from './constants';

interface SectionHeadingProps {
  id: string;
  /** The opening of the sentence, in full ink. */
  lead: string;
  /** The rest of the sentence, in grey. */
  rest?: string;
  class?: ClassValue;
}

/** A one-sentence section heading whose second half is set in grey. */
export function SectionHeading(props: SectionHeadingProps) {
  const { id, lead, rest = '', class: className } = props;

  return (
    <h2
      id={id}
      class={[
        'text-ink text-[clamp(1.75rem,2.8vw,2.25rem)] leading-[1.15] font-normal tracking-[-0.025em] text-balance',
        className,
      ]}
    >
      {lead} <span class="text-ink-faint">{rest}</span>
    </h2>
  );
}
