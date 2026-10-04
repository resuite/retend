import { Cell } from 'retend';

import type { ClassValue } from './constants';

interface CopyCommandProps {
  command: string;
  class?: ClassValue;
}

/** A one-line shell command in a frosted pill, with a copy button. */
export function CopyCommand(props: CopyCommandProps) {
  const { command, class: className } = props;
  const copied = Cell.source(false);
  const label = Cell.derived(() => (copied.get() ? 'Copied' : 'Copy'));
  let timer: ReturnType<typeof setTimeout> | undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return;
    }
    copied.set(true);
    clearTimeout(timer);
    timer = setTimeout(() => copied.set(false), 1600);
  };

  return (
    <div
      class={[
        'flex min-w-0 items-center gap-3 rounded-full border border-white/60 bg-white/65 py-1.5 pr-1.5 pl-5 text-[#1c1917] backdrop-blur-md',
        className,
      ]}
    >
      <code class="text-small min-w-0 flex-1 truncate text-left font-mono">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        class="text-caption h-8 shrink-0 rounded-full bg-[#1c1917] px-3.5 text-white hover:bg-[#1c1917]/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917]"
      >
        <span aria-live="polite">{label}</span>
      </button>
    </div>
  );
}
