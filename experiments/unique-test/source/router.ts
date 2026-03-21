import { Router } from 'retend/router';

import App from './App';
import { WithParentTransitions } from './WithParentTransitions';

export function createRouter() {
  return new Router({
    routes: [
      { path: '/', component: App },
      { path: '/parent', component: WithParentTransitions },
    ],
  });
}
