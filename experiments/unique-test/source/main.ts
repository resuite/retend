/// <reference types="vite/client" />
/// <reference types="retend-web/jsx-runtime" />
import { hydrate } from 'retend-server/client';

import { createRouter } from './router';

hydrate(createRouter).then(() => {
  console.log('[retend-server] app successfully hydrated.');
});
