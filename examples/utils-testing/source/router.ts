import { createWebRouter, lazy } from 'retend/router';
import { startRoute } from './views/start/routes';

export function createRouter() {
  return createWebRouter({
    routes: [
      startRoute,
      {
        name: 'LLM Test',
        path: 'llm-test',
        component: lazy(() => import('./views/start/llm-test')),
      },
      {
        name: 'Page 1',
        path: 'page-1',
        component: lazy(() => import('./views/test-pages/page1')),
      },
      {
        name: 'Page 2',
        path: 'page-2',
        component: lazy(() => import('./views/test-pages/page2')),
      },
    ],
  });
}
