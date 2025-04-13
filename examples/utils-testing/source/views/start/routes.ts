import { defineRoute, lazy } from 'retend/router';
import Start from '.';

export const startRoute = defineRoute({
  name: 'Start View',
  path: '/',
  component: Start,
  children: [
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
  ],
});
