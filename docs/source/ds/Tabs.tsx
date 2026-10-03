import type { JSX } from 'retend/jsx-runtime';

import { Cell, For } from 'retend';

export interface TabItem {
  id: string;
  label: string;
  content: () => JSX.Element;
}

interface TabsProps {
  /** Accessible name for the tab list. Also seeds element ids. */
  label: string;
  tabs: TabItem[];
  /** Overrides the id prefix when the same label appears twice on a page. */
  id?: string;
}

interface TabState {
  tab: TabItem;
  isActive: Cell<boolean>;
  isInactive: Cell<boolean>;
  ariaSelected: Cell<string>;
  tabIndex: Cell<number>;
}

const NAV_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End']);

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/gu, '-');

function nextTabIndex(key: string, current: number, count: number): number {
  if (key === 'ArrowRight') return (current + 1) % count;
  if (key === 'ArrowLeft') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return current;
}

/**
 * Tabs with roving tabindex and arrow/Home/End navigation. All panels are
 * rendered and the inactive ones are hidden, so content stays in the DOM.
 */
export function Tabs(props: TabsProps) {
  const { label, tabs, id } = props;
  const base = slugify(id ?? label);
  const active = Cell.source(tabs[0].id);
  const states: TabState[] = tabs.map((tab) => ({
    tab,
    isActive: Cell.derived(() => active.get() === tab.id),
    isInactive: Cell.derived(() => active.get() !== tab.id),
    ariaSelected: Cell.derived(() => String(active.get() === tab.id)),
    tabIndex: Cell.derived(() => (active.get() === tab.id ? 0 : -1)),
  }));

  const select = (tabId: string) => () => active.set(tabId);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!NAV_KEYS.has(event.key)) return;
    event.preventDefault();
    const current = tabs.findIndex((tab) => tab.id === active.get());
    const next = nextTabIndex(event.key, current, tabs.length);
    active.set(tabs[next].id);
    const buttons = (event.currentTarget as HTMLElement).children;
    (buttons[next] as HTMLElement).focus();
  };

  return (
    <div class="border-line bg-raised overflow-hidden rounded-lg border">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        class="border-line bg-sunken flex gap-1 border-b px-2 pt-2"
      >
        {For(
          states,
          (state) => (
            <button
              type="button"
              role="tab"
              id={`${base}-tab-${state.tab.id}`}
              aria-controls={`${base}-panel-${state.tab.id}`}
              aria-selected={state.ariaSelected}
              tabIndex={state.tabIndex}
              onClick={select(state.tab.id)}
              class={[
                'text-small focus-visible:outline-accent rounded-t-md border-b-2 px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:-outline-offset-2',
                {
                  'border-accent bg-raised text-ink': state.isActive,
                  'text-ink-soft hover:text-ink border-transparent':
                    state.isInactive,
                },
              ]}
            >
              {state.tab.label}
            </button>
          ),
          { key: (state) => state.tab.id }
        )}
      </div>
      {For(
        states,
        (state) => (
          <div
            role="tabpanel"
            id={`${base}-panel-${state.tab.id}`}
            aria-labelledby={`${base}-tab-${state.tab.id}`}
            class={{ hidden: state.isInactive }}
          >
            {state.tab.content()}
          </div>
        ),
        { key: (state) => state.tab.id }
      )}
    </div>
  );
}
