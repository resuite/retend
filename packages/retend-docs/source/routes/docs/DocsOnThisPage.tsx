import { Cell, For } from 'retend';
import { Link, useCurrentRoute } from 'retend/router';

type DocsHeading = { id: string; label: string; depth: number };

interface DocsOnThisPageProps {
  sectionHeadings: DocsHeading[];
}

export function DocsOnThisPage(props: DocsOnThisPageProps) {
  const { sectionHeadings } = props;

  return (
    <aside class="docs-on-this-page hidden lg:sticky lg:top-8 lg:block lg:self-start">
      <h2 class="text-fg-muted text-xs tracking-[0.08em] uppercase">
        On This Page
      </h2>
      <nav class="mt-4" aria-label="Page sections">
        <ul class="flex flex-col gap-2">
          {For(
            sectionHeadings,
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
    return `${currentRoute.get().path}${currentRoute.get().query}#${heading.id}`;
  });

  let itemClass = 'text-fg-muted hover:text-brand text-sm transition-colors';
  if (heading.depth > 2) {
    itemClass = 'text-fg-muted hover:text-brand text-sm transition-colors pl-3';
  }

  return (
    <li>
      <Link href={href} class={itemClass}>
        {heading.label}
      </Link>
    </li>
  );
}
