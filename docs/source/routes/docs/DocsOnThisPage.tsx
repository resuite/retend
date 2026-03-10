import { Cell, For } from 'retend';
import { Link, useCurrentRoute } from 'retend/router';

import type { DocPage } from './docsData';

type DocsHeading = DocPage['headings'][number];

interface DocsOnThisPageProps {
  sectionHeadings: DocsHeading[];
}

export function DocsOnThisPage(props: DocsOnThisPageProps) {
  const { sectionHeadings } = props;

  const displayHeadings =
    sectionHeadings.length > 0
      ? sectionHeadings
      : [{ id: '', selector: '' as const, label: 'Overview', depth: 2 }];

  return (
    <aside class="hidden lg:sticky lg:top-[calc(var(--header-height)+var(--spacing)*14)] lg:block lg:w-52 lg:self-start">
      <div class="mb-4">
        <h2 class="text-fg-muted text-xs font-medium tracking-[0.08em] uppercase">
          On This Page
        </h2>
      </div>
      <nav aria-label="Page sections">
        <ul class="border-border/60 relative ml-[0.5px] flex flex-col gap-2 border-l">
          {For(
            displayHeadings,
            (heading) => (
              <HeadingRoute heading={heading} />
            ),
            { key: 'id' }
          )}
        </ul>
      </nav>
    </aside>
  );
}

interface HeadingRouteProps {
  heading: DocsHeading;
}

function HeadingRoute(props: HeadingRouteProps) {
  const { heading } = props;
  const currentRoute = useCurrentRoute();

  const href = Cell.derived(() => {
    return `${currentRoute.get().path}${currentRoute.get().query}${heading.selector}`;
  });

  const isActive = Cell.derived(() => {
    return currentRoute.get().hash === heading.selector;
  });
  const isNotActive = Cell.derived(() => !isActive.get());

  const depthPadding = heading.depth === 2 ? 'pl-3' : 'pl-6';
  const fontSize = heading.depth > 2 ? 'text-[0.78rem]' : 'text-[0.85rem]';

  return (
    <li class="relative">
      <Link
        href={href}
        class={[
          'relative block py-1 transition-colors',
          depthPadding,
          fontSize,
          {
            'text-fg font-bold': isActive,
            'text-fg-muted hover:text-fg font-medium': isNotActive,
          },
        ]}
      >
        {heading.label}
      </Link>
    </li>
  );
}
