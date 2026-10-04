import type { JSX } from 'retend/jsx-runtime';

interface StepsProps {
  children?: JSX.Template;
}

interface StepProps {
  title: string;
  children?: JSX.Template;
}

/** Numbering and the connector line come from the .ds-steps CSS counter. */
export function Steps(props: StepsProps) {
  const { children } = props;

  return <ol class="ds-steps">{children}</ol>;
}

export function Step(props: StepProps) {
  const { title, children } = props;

  return (
    <li class="ds-step">
      <p class="text-h3 text-ink font-semibold">{title}</p>
      <div class="text-body text-ink-soft mt-1.5 [&>*+*]:mt-3">{children}</div>
    </li>
  );
}
