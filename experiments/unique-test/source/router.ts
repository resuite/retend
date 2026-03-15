import { Router } from 'retend/router';

import { WithParentTransitions } from '@/WithParentTransitions';

import App from './App';

export function createRouter() {
  return new Router({
    routes: [
      { path: '/', component: App },
      { path: '/parent', component: WithParentTransitions },
    ],
  });
}
