import { Cell } from 'retend';
import { useCurrentRoute } from 'retend/router';

import { sectionEntries } from './docsData';
import { MobileMenuButton, MobileOverlay } from './DocsSidebarChrome';
import { SidebarNav } from './DocsSidebarNav';

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

export function DocsSidebar() {
  const isOpen = Cell.source(false);
  const isClosed = Cell.derived(() => !isOpen.get());
  const toggle = () => isOpen.set(!isOpen.get());
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
        <SidebarNav items={sidebarItems} toggle={toggle} />
      </aside>
    </>
  );
}
