import type { Cell } from 'retend';

import { If } from 'retend';

export function MobileMenuButton(props: { toggle: () => void }) {
  return (
    <button
      type="button"
      onClick={props.toggle}
      class={[
        'mb-6 w-fit lg:hidden',
        'bg-surface text-fg sticky top-[calc(var(--header-height)+var(--spacing)*6)] z-30 flex items-center gap-2 rounded-xl font-bold',
        'border-border border px-3 py-2 text-sm shadow-[-3px_3px_0_var(--color-card-shadow)] transition-all active:translate-y-0.5 active:shadow-[0px_0px_0_var(--color-card-shadow)] dark:shadow-[-5px_5px_0_var(--color-card-shadow)]',
      ]}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M4 6h16M4 12h16m-7 6h7"
        />
      </svg>
      Menu
    </button>
  );
}

export function MobileOverlay(props: {
  isOpen: Cell<boolean>;
  toggle: () => void;
}) {
  return (
    <>
      {If(props.isOpen, {
        true: () => (
          <div
            class="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={props.toggle}
          />
        ),
      })}
    </>
  );
}
