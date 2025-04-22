import { createWebRouter, lazy } from 'retend/router';
import { startRoute } from './views/start/routes';

export * as context from 'retend/context';
export function createRouter() {
  return createWebRouter({
    routes: [
      startRoute,
      {
        name: 'LLM Test',
        path: 'llm-test',
        component: lazy(() => import('./views/start/llm-test')),
      },
    ],
  });
}
