import { Router } from 'retend/router';

import { MainLayout } from '@/layouts/MainLayout';
import { Home } from '@/routes/Home';
import { QuickstartPage } from '@/routes/QuickstartPage';

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
            path: '/quickstart',
            component: QuickstartPage,
          },
        ],
      },
    ],
  });
}
