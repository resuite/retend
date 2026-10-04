import type { JSX } from 'retend/jsx-runtime';

interface SectionProps {
  id: string;
  title: string;
  description: string;
  children?: JSX.Template;
}

export function Section(props: SectionProps) {
  const { id, title, description, children } = props;

  return (
    <section id={id} class="scroll-mt-8">
      <div class="mb-8 max-w-2xl">
        <h2 class="text-h2 text-ink font-semibold">{title}</h2>
        <p class="text-body text-ink-soft mt-2">{description}</p>
      </div>
      {children}
    </section>
  );
}
