/// <reference types="vite/client" />
import { Router } from 'retend/router';

import { DocsLayout } from '@/layouts/DocsLayout';
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
