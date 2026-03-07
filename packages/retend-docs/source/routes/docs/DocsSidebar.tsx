import { Cell, For, If } from 'retend';
import { Link } from 'retend/router';

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

function MobileMenuButton(props: { toggle: () => void }) {
  return (
    <div class="mb-6 lg:hidden">
      <button
        type="button"
        onClick={props.toggle}
        class="text-fg flex items-center gap-2 rounded-md border border-[#5c5c5c] px-3 py-2 text-sm"
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
    </div>
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

function SidebarNav(props: { closeSidebar: () => void }) {
  return (
    <nav
      class="flex flex-col gap-7 overflow-y-auto pb-4"
      aria-label="Documentation pages"
    >
      <ul class="flex flex-col gap-3">
        {For(
          flatDocs,
          (docPage) => (
            <li>
              <Link
                href={docPage.href}
                class="text-fg-muted hover:text-brand block py-1 text-sm transition-colors"
                onClick={props.closeSidebar}
              >
                {docPage.label}
              </Link>
            </li>
          ),
          { key: 'href' }
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

  return (
    <>
      <MobileMenuButton toggle={toggle} />
      <MobileOverlay isOpen={isOpen} toggle={toggle} />

      <aside
        class={[
          'fixed inset-y-0 left-0 z-50 flex w-68 flex-col gap-6 border-r border-[#5c5c5c] p-6 transition-transform duration-200 ease-in-out',
          'lg:sticky lg:top-[calc(var(--header-height)+var(--spacing)*14)] lg:z-0 lg:h-[calc(100vh-var(--header-height)-var(--spacing)*22)] lg:w-auto lg:translate-x-0',
          'lg:flex-col lg:overflow-y-auto lg:border-r-0 lg:bg-transparent lg:p-0',
          {
            'translate-x-0': isOpen,
            '-translate-x-full': isClosed,
          },
        ]}
      >
        <SidebarHeader toggle={toggle} />
        <SidebarNav closeSidebar={closeSidebar} />
      </aside>
    </>
  );
}
