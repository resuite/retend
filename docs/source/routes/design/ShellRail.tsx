import { For } from 'retend';

import { Kbd } from '@/ds/Kbd';

interface RailItem {
  label: string;
  active?: boolean;
}

const ITEMS: RailItem[] = [
  { label: 'Conditional Rendering with If', active: true },
  { label: 'Rendering Lists with For' },
  { label: 'Multi-State Rendering with Switch' },
];

/** Static stand-in. The real rail will follow scroll position. */
export function ShellRail() {
  return (
    <aside class="hidden xl:block">
      <p class="text-caption text-ink-faint mb-3 font-medium tracking-wider uppercase">
        On this page
      </p>
      <ul class="border-line flex flex-col gap-2 border-l">
        {For(
          ITEMS,
          (item) => (
            <li
              class={[
                'text-small -ml-px border-l-2 py-0.5 pl-3',
                {
                  'border-accent text-accent-ink font-medium':
                    item.active === true,
                  'text-ink-soft border-transparent': item.active !== true,
                },
              ]}
            >
              {item.label}
            </li>
          ),
          { key: (item) => item.label }
        )}
      </ul>
    </aside>
  );
}

export function ShellTopBar() {
  return (
    <header class="border-line bg-paper flex items-center justify-between gap-4 border-b px-5 py-3 md:px-8">
      <span class="text-h3 text-ink font-semibold">retend</span>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="border-line-input bg-raised text-small text-ink-soft flex items-center gap-3 rounded-md border py-1.5 pr-2 pl-3"
        >
          Search docs
          <Kbd>⌘K</Kbd>
        </button>
        <span class="text-caption text-ink-faint hidden font-mono sm:inline">
          v0.0.33
        </span>
      </div>
    </header>
  );
}
