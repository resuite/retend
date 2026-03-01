import type { JSX } from 'retend/jsx-runtime';

export interface SectionHeaderProps {
  label: JSX.ValueOrCell<string>;
  title: JSX.ValueOrCell<string>;
  description: JSX.ValueOrCell<string | JSX.Element>;
  class?: JSX.ValueOrCell<string | string[] | object>;
}

export function SectionHeader(props: SectionHeaderProps) {
  const { label, title, description, class: className, ...rest } = props;

  return (
    <div class={['mb-8 max-w-[640px] md:mb-12', className]} {...rest}>
      <span class="text-brand mb-3 block font-mono text-xs tracking-widest uppercase md:mb-4">
        {label}
      </span>
      <h2 class="text-fg mb-4 text-[1.6rem] leading-tight tracking-tight sm:text-[1.9rem] md:mb-5 md:text-[2rem]">
        {title}
      </h2>
      <p class="text-fg-muted text-base sm:text-lg">{description}</p>
    </div>
  );
}
