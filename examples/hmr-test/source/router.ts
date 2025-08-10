import { createWebRouter } from 'retend/router';
import { startRoute } from './views/routes';

export function createRouter() {
  return createWebRouter({ routes: [startRoute] });
}
