/// <reference types="vite/client" />
import { hydrate } from 'retend-server/client';
import { createRouter } from './router';

hydrate(createRouter)
  .then(() => {
    console.log('[retend-server] app successfully hydrated.');
  });