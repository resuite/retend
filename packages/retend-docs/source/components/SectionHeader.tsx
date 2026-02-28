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
    <div class={['mb-12 max-w-[640px]', className]} {...rest}>
      <span class="text-brand mb-4 block font-mono text-xs tracking-widest uppercase">
        {label}
      </span>
      <h2 class="text-fg mb-5 text-[2rem] leading-tight tracking-tight">
        {title}
      </h2>
      <p class="text-fg-muted text-lg">{description}</p>
    </div>
  );
}
