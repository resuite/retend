import { Router } from 'retend/router';

import Animation from './Animation';
import App from './App';
import BoxShadows from './BoxShadows';
import FittedContent from './FittedContent';
import Stickers from './Stickers';

export function createRouter() {
  return new Router({
    routes: [
      { path: '/', component: App },
      { path: '/stickers', component: Stickers },
      { path: '/box-shadows', component: BoxShadows },
      { path: '/fitted-content', component: FittedContent },
      { path: '/animation', component: Animation },
    ],
  });
}
