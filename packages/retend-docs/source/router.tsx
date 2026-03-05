import { RetendDevTools } from 'retend-web-devtools';
/// <reference types="vite/client" />
import { Router } from 'retend/router';

import { MainLayout } from '@/layouts/MainLayout';
import { DocsPage } from '@/routes/DocsPage';
import { Home } from '@/routes/Home';
import { QuickstartPage } from '@/routes/QuickstartPage';

const Root = () => {
  if (import.meta.env.DEV) {
    return (
      <RetendDevTools initialPosition="top-left">
        <RetendDevTools>
          <MainLayout />
        </RetendDevTools>
      </RetendDevTools>
    );
  }

  return <MainLayout />;
};

export function createRouter() {
  return new Router({
    routes: [
      {
        path: '/',
        component: Root,
        children: [
          {
            path: '/',
            component: Home,
          },
          {
            path: '/quickstart',
            component: QuickstartPage,
          },
          {
            path: '/docs',
            component: DocsPage,
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
