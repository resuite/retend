import { Cell, For } from 'retend';
import { Link, useCurrentRoute } from 'retend/router';

import type { SidebarItem } from './DocsSidebar';

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
        <ul class="mt-2 ml-6 flex flex-col gap-2 border-l border-[#2f2f2f] pl-3">
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

export function SidebarNav(props: {
  items: SidebarItem[];
  toggle: () => void;
}) {
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
      <nav
        class="flex flex-col gap-7 overflow-y-auto pb-4"
        aria-label="Documentation pages"
      >
        <ul class="flex flex-col gap-3">
          {For(
            props.items,
            (item) => (
              <SidebarNode item={item} />
            ),
            { key: (item) => (item.type === 'link' ? item.href : item.label) }
          )}
        </ul>
      </nav>
    </>
  );
}
