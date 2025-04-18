// examples/utils-testing/source/views/start/routes.ts
import { defineRoute, lazy } from 'retend/router';
import Start from '.';

export const startRoute = defineRoute({
  name: 'Start View',
  path: '/',
  component: Start,
  children: [
    // ... other routes ...
    {
      name: 'Element Bounding',
      path: 'element-bounding',
      component: lazy(() => import('./element-bounding')),
    },
    {
      name: 'Window Size',
      path: 'window-size',
      component: lazy(() => import('./window-size')),
    },
    {
      name: 'Match Media',
      path: 'match-media',
      component: lazy(() => import('./match-media')),
    },
    {
      name: 'Live Date',
      path: 'live-date',
      component: lazy(() => import('./live-date')),
    },
    {
      name: 'Network Status',
      path: 'network-status',
      component: lazy(() => import('./network-status')),
    },
    {
      name: 'Local Storage Test',
      path: 'local-storage',
      component: lazy(() => import('./local-storage')),
    },
    {
      name: 'Session Storage Test',
      path: 'session-storage',
      component: lazy(() => import('./session-storage')),
    },
    {
      name: 'Router Lock Test',
      path: 'router-lock',
      component: lazy(() => import('./router-lock')),
    },
    {
      name: 'Input Test',
      path: 'input-test',
      component: lazy(() => import('./input-test')),
    },
  ],
});
