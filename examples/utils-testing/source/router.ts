import { createWebRouter } from 'retend/router';
import { startRoute } from './views/start/routes';

export function createRouter() {
  return createWebRouter({ routes: [startRoute] });
}