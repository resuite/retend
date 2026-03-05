import { For } from 'retend';
import { Link } from 'retend/router';

import { sectionEntries } from './docsData';

export function DocsSidebar() {
  return (
    <aside class="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
      <h1 class="text-fg text-xl tracking-tight">Documentation</h1>
      <nav class="flex flex-col gap-7" aria-label="Documentation pages">
        {For(sectionEntries, (entry) => {
          const sectionData = entry[1];

          return (
            <div class="flex flex-col gap-3">
              <Link
                href={sectionData.href}
                class="text-fg-muted hover:text-brand text-xs tracking-[0.08em] transition-colors"
              >
                {sectionData.label}
              </Link>
              <div class="flex flex-col gap-2">
                {For(
                  sectionData.pages,
                  (docPage) => (
                    <Link
                      href={docPage.href}
                      class="text-fg-muted hover:text-brand text-sm transition-colors"
                    >
                      {docPage.label}
                    </Link>
                  ),
                  { key: 'href' }
                )}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
