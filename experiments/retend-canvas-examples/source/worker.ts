import { setupWorkerContext } from 'retend-canvas-2d/worker';
import { createRouterRoot } from 'retend/router';

import { createRouter } from './router';

const router = createRouter();
setupWorkerContext(() => createRouterRoot(router), {
  onInit() {
    router.navigate('/');
  },
});

export default {};
