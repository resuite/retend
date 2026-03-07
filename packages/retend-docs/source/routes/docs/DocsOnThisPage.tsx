import { Cell, For, If } from 'retend';
import { Link, useCurrentRoute } from 'retend/router';

type DocsHeading = { id: string; label: string; depth: number };

interface DocsOnThisPageProps {
  sectionHeadings: DocsHeading[];
}

export function DocsOnThisPage(props: DocsOnThisPageProps) {
  const { sectionHeadings } = props;

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

  const isActive = Cell.derived(
    () => currentRoute.get().hash === `#${heading.id}`
  );
  const isNotActive = Cell.derived(() => !isActive.get());

  const depthPadding = heading.depth === 2 ? 'pl-3' : 'pl-6';
  const fontSize = heading.depth > 2 ? 'text-[0.78rem]' : 'text-[0.85rem]';

  return (
    <li class="relative">
      {If(isActive, {
        true: () => (
          <div class="bg-brand absolute top-1/2 -left-[1px] h-4 w-[2px] -translate-y-1/2 rounded-full" />
        ),
      })}
      <Link
        href={href}
        class={[
          'block py-1 transition-colors',
          depthPadding,
          fontSize,
          {
            'text-brand font-medium': isActive,
            'text-fg-muted hover:text-fg': isNotActive,
          },
        ]}
      >
        {heading.label}
      </Link>
    </li>
  );
}
