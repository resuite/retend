import type { JSX } from 'retend/jsx-runtime';

interface InlineCodeProps {
  children?: JSX.Template;
}

/** Uses a translucent ink tint so it reads on paper, sunken and wash surfaces. */
export function InlineCode(props: InlineCodeProps) {
  const { children } = props;

  return (
    <code class="bg-ink/[0.07] text-ink rounded px-1.5 py-0.5 font-mono text-[0.9em]">
      {children}
    </code>
  );
}
