import { Cell, onSetup } from 'retend';
import { useRouter, useCurrentRoute } from 'retend/router';

export function ScrollRestoration() {
  const router = useRouter();
  const currentRoute = useCurrentRoute();
  const basePath = Cell.derived(() => {
    const segments = currentRoute.get().fullPath.split('/');
    return `${segments[0]}/${segments[1]}/${segments[2]}`;
  });
  basePath.listen(() => {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const state = window.history.state;
        if (state?.scroll) {
          window.scrollTo(state.scroll.x, state.scroll.y);
        } else {
          window.scrollTo(0, 0);
        }
      });
    });
  });

  onSetup(() => {
    // 1. Disable browser auto-restore
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // 2. Save position before leaving a route
    const saveScrollPosition = () => {
      const scroll = { x: window.scrollX, y: window.scrollY };
      const currentState = window.history.state || {};
      window.history.replaceState({ ...currentState, scroll }, '');
    };

    // 3. Attach save listener
    router.addEventListener('beforenavigate', saveScrollPosition);

    // Cleanup
    return () => {
      router.removeEventListener('beforenavigate', saveScrollPosition);
    };
  });

  return null;
}
