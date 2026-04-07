import { Router } from 'retend/router';

import App from './App';

export function createRouter() {
  return new Router({
    routes: [{ path: '/', component: App }],
  });
}
