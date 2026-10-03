import type { JSX } from 'retend/jsx-runtime';

type CalloutVariant = 'note' | 'tip' | 'warning' | 'danger';

interface CalloutProps {
  variant?: CalloutVariant;
  title?: string;
  children?: JSX.Template;
}

interface CalloutStyle {
  box: string;
  title: string;
  label: string;
}

const STYLES: Record<CalloutVariant, CalloutStyle> = {
  note: {
    box: 'border-line bg-sunken',
    title: 'text-ink-soft',
    label: 'Note',
  },
  tip: {
    box: 'border-good/25 bg-good-wash',
    title: 'text-good',
    label: 'Tip',
  },
  warning: {
    box: 'border-accent/30 bg-accent-wash',
    title: 'text-accent-ink',
    label: 'Warning',
  },
  danger: {
    box: 'border-bad/25 bg-bad-wash',
    title: 'text-bad',
    label: 'Danger',
  },
};

/** The label text carries the meaning; color only reinforces it. */
export function Callout(props: CalloutProps) {
  const { variant = 'note', title, children } = props;
  const style = STYLES[variant];
  const heading = title ?? style.label;

  return (
    <div role="note" class={['rounded-lg border px-4 py-3', style.box]}>
      <p class={['text-small font-semibold', style.title]}>{heading}</p>
      <div class="text-small text-ink mt-1 [&>*+*]:mt-2">{children}</div>
    </div>
  );
}
