import { Router } from 'retend/router';

import App from './App';
import Stickers from './Stickers';

export function createRouter() {
  return new Router({
    routes: [
      { path: '/', component: App },
      { path: '/stickers', component: Stickers },
    ],
  });
}
