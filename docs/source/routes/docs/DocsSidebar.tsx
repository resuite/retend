import { Cell, For, If } from 'retend';
import { Link, useCurrentRoute } from 'retend/router';

import { sectionEntries } from './docsData';

const flatDocs: Array<{ href: string; label: string }> = [];
for (const [, sectionData] of sectionEntries) {
  if (sectionData.pages && sectionData.pages.length > 0) {
    for (const docPage of sectionData.pages) {
      flatDocs.push({ href: docPage.href, label: docPage.label });
    }
  } else if (sectionData.href) {
    flatDocs.push({ href: sectionData.href, label: sectionData.label });
  }
}

export type SidebarItem =
  | { type: 'link'; href: string; label: string }
  | { type: 'group'; label: string; items: SidebarItem[] };

export const sidebarItems: SidebarItem[] = [];
const groups = [
  {
    label: 'Core Concepts',
    itemLabels: new Set([
      'Jsx And Components',
      'Special Attributes',
      'Reactivity And Cells',
      'Event Handling',
    ]),
    items: [] as SidebarItem[],
  },
  {
    label: 'Building Blocks',
    itemLabels: new Set([
      'Control Flow',
      'Lifecycle Hooks',
      'Context And Scopes',
    ]),
    items: [] as SidebarItem[],
  },
  {
    label: 'Routing',
    itemLabels: new Set([
      'Defining Routes',
      'Navigation',
      'Queries And Params',
      'Middleware',
      'Lazy Loading',
      'Route Locking',
      'View Transitions',
    ]),
    items: [] as SidebarItem[],
  },
  {
    label: 'Advanced Components',
    itemLabels: new Set(['Unique', 'Teleport', 'ShadowRoot', 'Await']),
    items: [] as SidebarItem[],
  },
  {
    label: 'Server Side Rendering',
    itemLabels: new Set([
      'Static Site Generation',
      'Hydration',
      'Page Metadata',
      'Client Only',
    ]),
    items: [] as SidebarItem[],
  },
  {
    label: 'Utilities',
    itemLabels: new Set([
      'Utilities Overview',
      'Utility Hooks',
      'Utility Components',
    ]),
    items: [] as SidebarItem[],
  },
];

for (const doc of flatDocs) {
  if (doc.href.startsWith('/docs/api/')) continue;
  let matchedGroup = false;
  for (const group of groups) {
    if (group.itemLabels.has(doc.label)) {
      group.items.push({ type: 'link', href: doc.href, label: doc.label });
      if (group.items.length === 1) {
        sidebarItems.push({
          type: 'group',
          label: group.label,
          items: group.items,
        });
      }
      matchedGroup = true;
      break;
    }
  }
  if (!matchedGroup) {
    sidebarItems.push({ type: 'link', href: doc.href, label: doc.label });
  }
}

function MobileMenuButton(props: { toggle: () => void }) {
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

function MobileOverlay(props: { isOpen: Cell<boolean>; toggle: () => void }) {
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

function SidebarHeader(props: { toggle: () => void }) {
  return (
    <>
      <div class="mb-2 flex items-center justify-between lg:hidden">
        <h1 class="text-fg text-xl tracking-tight">Documentation</h1>
        <button type="button" onClick={props.toggle} class="text-fg p-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <h1 class="text-fg hidden text-xl tracking-tight lg:block lg:pb-2">
        Documentation
      </h1>
    </>
  );
}

function SidebarNode(props: { item: SidebarItem }) {
  const { item } = props;
  const currentRoute = useCurrentRoute();

  if (item.type === 'link') {
    const isActive = Cell.derived(
      () => currentRoute.get().fullPath === item.href
    );
    const isNotActive = Cell.derived(() => !isActive.get());

    return (
      <li>
        <Link
          href={item.href}
          class={[
            'block py-1 text-sm transition-colors',
            {
              'text-fg-muted hover:text-brand': isNotActive,
              'text-brand font-medium': isActive,
            },
          ]}
        >
          {item.label}
        </Link>
      </li>
    );
  }

  const isGroupActive = Cell.derived(() => {
    return item.items.some(
      (subItem) =>
        subItem.type === 'link' && subItem.href === currentRoute.get().fullPath
    );
  });

  return (
    <li>
      <details class="group" open={isGroupActive}>
        <summary class="text-fg-muted hover:text-brand cursor-pointer list-none py-1 text-sm transition-colors [&::-webkit-details-marker]:hidden">
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="-rotate-90 transition-transform duration-200 group-open:rotate-0"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            {item.label}
          </div>
        </summary>
        <ul class="mt-2 ml-6 flex flex-col gap-2 border-l border-[#5c5c5c] pl-3">
          {For(
            item.items,
            (subItem) => (
              <SidebarNode item={subItem} />
            ),
            { key: (i) => (i.type === 'link' ? i.href : i.label) }
          )}
        </ul>
      </details>
    </li>
  );
}

function SidebarNav() {
  return (
    <nav
      class="flex flex-col gap-7 overflow-y-auto pb-4"
      aria-label="Documentation pages"
    >
      <ul class="flex flex-col gap-3">
        {For(
          sidebarItems,
          (item) => (
            <SidebarNode item={item} />
          ),
          { key: (item) => (item.type === 'link' ? item.href : item.label) }
        )}
      </ul>
    </nav>
  );
}

export function DocsSidebar() {
  const isOpen = Cell.source(false);
  const toggle = () => isOpen.set(!isOpen.get());
  const isClosed = Cell.derived(() => !isOpen.get());
  const closeSidebar = () => isOpen.set(false);

  useCurrentRoute().listen(closeSidebar);

  return (
    <>
      <MobileMenuButton toggle={toggle} />
      <MobileOverlay isOpen={isOpen} toggle={toggle} />

      <aside
        class={[
          'bg-bg border-border fixed inset-y-0 left-0 z-50 flex w-68 flex-col gap-6 border-r p-6 transition-transform duration-200 ease-in-out',
          'lg:sticky lg:top-[calc(var(--header-height)+var(--spacing)*14)] lg:z-0 lg:h-[calc(100vh-var(--header-height)-var(--spacing)*22)] lg:w-auto lg:translate-x-0 lg:bg-transparent',
          'lg:flex-col lg:overflow-y-auto lg:border-r-0 lg:bg-transparent lg:p-0',
          {
            'translate-x-0': isOpen,
            '-translate-x-full': isClosed,
          },
        ]}
      >
        <SidebarHeader toggle={toggle} />
        <SidebarNav />
      </aside>
    </>
  );
}
