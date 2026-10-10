import type { RouteLoadCompletedEvent, Router } from 'retend/router';

import type { GpuiWindow } from './window.js';

/**
 * Connects a router to a GPUI window.
 *
 * The router navigates to the window's `initialPath` straight away, and the
 * window title follows route titles from then on. A route without a title
 * keeps the current window title, as a browser keeps the current page title.
 * Navigation errors are reported through the window's application error path.
 *
 * @returns A function that stops updating the window title.
 */
export function attachRouter(router: Router, window: GpuiWindow): () => void {
  const handleRouteLoadCompleted = (event: RouteLoadCompletedEvent) => {
    if (event.title) window.title.set(event.title);
  };
  router.addEventListener('routeloadcompleted', handleRouteLoadCompleted);

  router.navigate(window.initialPath).catch((error: unknown) => {
    window.host.reportApplicationError(error);
  });

  return () => {
    router.removeEventListener('routeloadcompleted', handleRouteLoadCompleted);
  };
}
