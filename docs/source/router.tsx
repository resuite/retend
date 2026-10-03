/// <reference types="vite/client" />
import { lazy, Router } from 'retend/router';

import { DocsLayout } from '@/layouts/DocsLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { DocsPage } from '@/routes/DocsPage';
import { Home } from '@/routes/Home';

export function createRouter() {
  // The design-system kitchen sink only exists in dev. Vite replaces
  // import.meta.env.DEV with false in builds, so the lazy chunk is dropped.
  const devRoutes = import.meta.env.DEV
    ? [
        {
          path: '/design',
          component: lazy(() => import('@/routes/Design')),
        },
      ]
    : [];

  return new Router({
    routes: [
      ...devRoutes,
      {
        path: '/',
        component: MainLayout,
        children: [
          {
            path: '/',
            component: Home,
          },
          {
            path: '/docs',
            redirect: '/docs/getting-started',
            component: DocsLayout,
            children: [
              {
                path: ':section',
                component: DocsPage,
              },
              {
                path: ':section/:page',
                component: DocsPage,
              },
              {
                path: ':section/:page/:subpage',
                component: DocsPage,
              },
            ],
          },
        ],
      },
    ],
  });
}
