/// <reference types="vite/client" />
import { Router } from 'retend/router';

import { MainLayout } from '@/layouts/MainLayout';
import { DocsPage } from '@/routes/DocsPage';
import { Home } from '@/routes/Home';

export function createRouter() {
  return new Router({
    routes: [
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
            component: () => null,
          },
          {
            path: '/docs/:section',
            component: DocsPage,
          },
          {
            path: '/docs/:section/:page',
            component: DocsPage,
          },
        ],
      },
    ],
  });
}
