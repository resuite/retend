import { For } from 'retend';
import { Link } from 'retend/router';

import { AnyLink } from '@/components/AnyLink';
import { paintings } from '@/routes/home/paintings';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const npm = (name: string): FooterLink => ({
  label: name,
  href: `https://npmjs.com/package/${name}`,
  external: true,
});

const github = (label: string, path = ''): FooterLink => ({
  label,
  href: `https://github.com/resuite/retend${path}`,
  external: true,
});

const columns: FooterColumn[] = [
  {
    title: 'Learn',
    links: [
      { label: 'Getting started', href: '/docs/getting-started' },
      { label: 'Reactivity and Cells', href: '/docs/reactivity-and-cells' },
      { label: 'Routing', href: '/docs/defining-routes' },
      { label: 'Rendering', href: '/docs/rendering-architecture' },
    ],
  },
  {
    title: 'Packages',
    links: [
      npm('retend'),
      npm('retend-web'),
      npm('retend-gpui'),
      npm('retend-server'),
    ],
  },
  {
    title: 'Project',
    links: [
      github('GitHub'),
      github('Releases', '/releases'),
      github('Issues', '/issues'),
    ],
  },
];

const LINK_CLASS =
  'text-small text-ink hover:text-ink-soft motion-safe:transition-colors';

export function Footer() {
  return (
    <footer class="border-line border-t">
      <div class="flex flex-col justify-between gap-12 px-5 py-14 sm:px-8 md:flex-row md:px-10">
        <div class="flex max-w-xs flex-col gap-3">
          <Link
            class="text-ink text-xl tracking-[-0.02em]"
            href="/"
            aria-label="Retend home"
          >
            retend
          </Link>
          <p class="text-small text-ink-faint">
            A reactive framework for user interfaces, on the web and the
            desktop.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-16">
          {For(columns, (column) => (
            <div class="flex flex-col gap-4">
              <h3 class="text-small text-ink-faint">{column.title}</h3>
              <ul class="flex flex-col gap-3">
                {For(column.links, (link) => (
                  <li>
                    <AnyLink
                      href={link.href}
                      external={link.external}
                      class={LINK_CLASS}
                    >
                      {link.label}
                    </AnyLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div class="relative isolate h-56 overflow-hidden md:h-72">
        <img
          src={paintings.sunset}
          alt=""
          loading="lazy"
          class="home-painting absolute inset-0 -z-10 size-full object-cover object-[50%_18%]"
        />
        <div class="text-small flex h-full items-end justify-end px-5 pb-4 text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/0.4)] sm:px-8 md:px-10">
          <a href="#top" class="hover:text-white">
            (Back to top)
          </a>
        </div>
      </div>
    </footer>
  );
}
