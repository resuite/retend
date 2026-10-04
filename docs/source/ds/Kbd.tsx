import type { JSX } from 'retend/jsx-runtime';

interface KbdProps {
  children?: JSX.Template;
}

export function Kbd(props: KbdProps) {
  const { children } = props;

  return (
    <kbd class="border-line-strong bg-raised text-caption text-ink-soft rounded border border-b-2 px-1.5 py-0.5 font-mono">
      {children}
    </kbd>
  );
}
