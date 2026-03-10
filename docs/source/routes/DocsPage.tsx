/// <reference types="vite/client" />
import { If } from 'retend';
import { Link, useCurrentRoute } from 'retend/router';

import { createMDXComponents } from '@/components/MDXComponents';
import { GithubIcon } from '@/icons';

import { docPages } from './docs/docsData';
import { DocsOnThisPage } from './docs/DocsOnThisPage';
import { sidebarItems } from './docs/DocsSidebar';

export function DocsPage() {
  const currentRoute = useCurrentRoute();

  let activePath = currentRoute.get().path;
  if (activePath.endsWith('/')) {
    activePath = activePath.slice(0, -1);
  }

  let activePage = null;
  for (const docPage of docPages) {
    if (docPage.href !== activePath) continue;
    activePage = docPage;
    break;
  }

  if (!activePage) {
    return (
      <section class="mx-auto w-full max-w-300 px-5 sm:px-6 md:px-10">
        <h1 class="text-fg text-3xl tracking-tight">Page not found</h1>
      </section>
    );
  }

  const ActivePage = activePage.Component;
  const sectionHeadings = activePage.headings;
  const editHref = `https://github.com/resuite/retend/edit/main/docs/content/${activePage.sortKey}.mdx`;
  const components = createMDXComponents();

  const flatItems: { href: string; label: string }[] = [];
  for (const item of sidebarItems) {
    if (item.type === 'link') {
      flatItems.push(item);
    } else {
      for (const child of item.items) {
        if (child.type === 'link') {
          flatItems.push(child);
        }
      }
    }
  }

  let currentIndex = -1;
  for (let i = 0; i < flatItems.length; i++) {
    if (flatItems[i].href === activePath) {
      currentIndex = i;
      break;
    }
  }

  const prevPage = currentIndex > 0 ? flatItems[currentIndex - 1] : null;
  const nextPage =
    currentIndex !== -1 && currentIndex < flatItems.length - 1
      ? flatItems[currentIndex + 1]
      : null;

  const showPlaceholder = !prevPage && !nextPage;

  return (
    <>
      <article class="docs-markdown min-w-0 text-pretty">
        <ActivePage components={components} />

        <div class="mt-10">
          <a
            href={editHref}
            target="_blank"
            rel="noreferrer"
            class="text-fg-muted hover:text-brand inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <GithubIcon />
            Edit this page on GitHub
          </a>
        </div>

        <div class="border-border mt-16 mb-16 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:justify-between">
          {If(prevPage, (prevPage) => (
            <Link
              href={prevPage.href}
              class="hover:border-brand/40 group border-border bg-surface flex flex-1 flex-col items-start gap-1 rounded-xl border p-4 shadow-[-3px_3px_0_var(--color-card-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[-5px_5px_0_var(--color-card-shadow)] dark:shadow-[-7px_7px_0_var(--color-card-shadow)] dark:hover:shadow-[-5px_5px_0_var(--color-card-shadow)]"
            >
              <span class="text-fg-muted text-xs font-bold tracking-wider uppercase">
                Previous
              </span>
              <span class="text-fg group-hover:text-brand font-medium transition-colors">
                ← {prevPage.label}
              </span>
            </Link>
          ))}
          {If(nextPage, (nextPage) => (
            <Link
              href={nextPage.href}
              class="hover:border-brand/40 group border-border bg-surface flex flex-1 flex-col items-end gap-1 rounded-xl border p-4 text-right shadow-[-3px_3px_0_var(--color-card-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[-5px_5px_0_var(--color-card-shadow)] dark:shadow-[-7px_7px_0_var(--color-card-shadow)] dark:hover:shadow-[-5px_5px_0_var(--color-card-shadow)]"
            >
              <span class="text-fg-muted text-xs font-bold tracking-wider uppercase">
                Next
              </span>
              <span class="text-fg group-hover:text-brand font-medium transition-colors">
                {nextPage.label} →
              </span>
            </Link>
          ))}
          {If(showPlaceholder, () => (
            <div class="flex-1" />
          ))}
        </div>
      </article>

      <DocsOnThisPage sectionHeadings={sectionHeadings} />
    </>
  );
}

DocsPage.metadata = ({ params }: { params: Map<string, string> }) => {
  const section = params.get('section');
  const pageParam = params.get('page');
  const subpage = params.get('subpage');

  let activePath = '/docs';
  if (section) activePath += '/' + section;
  if (pageParam) activePath += '/' + pageParam;
  if (subpage) activePath += '/' + subpage;

  let activePage = null;
  for (const docPage of docPages) {
    if (docPage.href === activePath) {
      activePage = docPage;
      break;
    }
  }

  if (!activePage) {
    return { title: 'Page Not Found | Retend' };
  }

  let title = activePage.title || activePage.label;

  return {
    title: `${title} | Retend`,
    description: activePage.description,
    ogTitle: title,
    ogDescription: activePage.description,
    ogImage: `https://retend.dev/og/${activePage.slug}.png`,
    ogUrl: `https://retend.dev${activePath}`,
    ogType: 'article',
    ogLocale: 'en_US',
    ogLogo: 'https://retend.dev/og/overview.png',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: activePage.description,
    twitterImage: `https://retend.dev/og/${activePage.slug}.png`,
  };
};
