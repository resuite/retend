import { For } from 'retend';
import { Link } from 'retend/router';

interface NavLink {
  href: string;
  label: string;
  current?: 'page';
}

interface NavGroup {
  title: string;
  links: NavLink[];
}

const GROUPS: NavGroup[] = [
  {
    title: 'Start',
    links: [{ href: '/docs/getting-started', label: 'Getting Started' }],
  },
  {
    title: 'Core Concepts',
    links: [
      { href: '/docs/special-attributes', label: 'Special Attributes' },
      { href: '/docs/control-flow', label: 'Control Flow', current: 'page' },
      { href: '/docs/lifecycle-hooks', label: 'Lifecycle Hooks' },
    ],
  },
  {
    title: 'Routing',
    links: [
      { href: '/docs/defining-routes', label: 'Defining Routes' },
      { href: '/docs/lazy-loading', label: 'Lazy Loading' },
    ],
  },
];

export function ShellNav() {
  return (
    <nav aria-label="Documentation" class="hidden md:block">
      <div class="flex flex-col gap-7">
        {For(
          GROUPS,
          (group) => (
            <div>
              <p class="text-caption text-ink-faint mb-2 px-3 font-medium tracking-wider uppercase">
                {group.title}
              </p>
              <ul class="flex flex-col gap-0.5">
                {For(
                  group.links,
                  (link) => (
                    <li>
                      <Link
                        href={link.href}
                        aria-current={link.current}
                        class={[
                          'text-small focus-visible:outline-accent block rounded-md px-3 py-1.5 focus-visible:outline-2',
                          {
                            'bg-accent-wash text-accent-ink font-medium':
                              link.current === 'page',
                            'text-ink-soft hover:bg-sunken hover:text-ink':
                              link.current !== 'page',
                          },
                        ]}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ),
                  { key: 'href' }
                )}
              </ul>
            </div>
          ),
          { key: 'title' }
        )}
      </div>
    </nav>
  );
}
