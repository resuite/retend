/** @import { RouteLoadCompletedEvent, RouteLockPreventedEvent, Router } from 'retend/router'; */

/**
 * Constructs a path with its hash and search parameters.
 * @param {Window} window
 * @returns {string}
 */
function getFullPath(window) {
  const { location } = window;
  return location.pathname + location.search + location.hash;
}

/**
 * Connects a renderer-independent `Router` to a browser window.
 * Syncs browser history, location, and page titles with router navigation.
 * @param {Router} router
 * @param {Window} window
 * @returns {() => void} A function that detaches the router from the window.
 */
export function attachRouter(router, window) {
  const handler = async () => {
    const path = getFullPath(window);
    await router.sync(path);
    // History traversal syncs without `routeloadcompleted`,
    // which is where navigations apply the title; apply it here too.
    if (router.title) {
      window.document.title = router.title;
    }
  };

  /**
   * @param {RouteLockPreventedEvent} event
   */
  const handleRoutePrevented = (event) => {
    window.history.replaceState({}, '', event.lockedPath);
  };

  /** @param {RouteLoadCompletedEvent} event */
  const handleRouteLoadCompleted = (event) => {
    const { newHistoryLength, oldHistoryLength, replace, fullPath, title } =
      event;
    if (title) {
      window.document.title = title;
    }
    const goingBack = newHistoryLength < oldHistoryLength;
    if (goingBack) {
      const negativeDiff = newHistoryLength - oldHistoryLength;
      window.history.go(negativeDiff);
      return;
    }

    const isSamePath = getFullPath(window) === fullPath;
    if (isSamePath) return;

    const nextPath = fullPath;
    if (replace || newHistoryLength === oldHistoryLength) {
      window.history?.replaceState(null, '', nextPath);
    } else window.history?.pushState(null, '', nextPath);
  };

  window?.addEventListener('popstate', handler);
  window?.addEventListener('hashchange', handler);
  window?.addEventListener('load', handler);
  window?.addEventListener('DOMContentLoaded', handler);
  router.addEventListener('routelockprevented', handleRoutePrevented);
  router.addEventListener('routeloadcompleted', handleRouteLoadCompleted);

  return () => {
    window?.removeEventListener('popstate', handler);
    window?.removeEventListener('hashchange', handler);
    window?.removeEventListener('load', handler);
    window?.removeEventListener('DOMContentLoaded', handler);
    router.removeEventListener('routelockprevented', handleRoutePrevented);
    router.removeEventListener('routeloadcompleted', handleRouteLoadCompleted);
  };
}
