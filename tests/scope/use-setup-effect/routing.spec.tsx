import { describe, it, expect, vi } from 'vitest';
import { runPendingSetupEffects, useSetupEffect } from 'retend';
import {
  createWebRouter,
  defineRoutes,
  Outlet,
  useRouter,
} from 'retend/router';
import { getGlobalContext } from 'retend/context';
import {
  routerSetupBrowser,
  getTextContent,
  routerRoot,
} from '../../setup.tsx';

describe('useSetupEffect with routing', () => {
  routerSetupBrowser();

  it('should run setup and cleanup on navigation', async () => {
    const setupFn = vi.fn();
    const cleanupFn = vi.fn();

    const EffectComponent = () => {
      useSetupEffect(() => {
        setupFn();
        return cleanupFn;
      });
      return <div>Effect Component</div>;
    };

    const OtherComponent = () => <div>Other Component</div>;

    const App = () => {
      const { Outlet } = useRouter();
      return (
        <div>
          <Outlet />
        </div>
      );
    };

    const routes = defineRoutes([
      {
        path: '/',
        component: App,
        children: [
          { path: 'effect', component: EffectComponent },
          { path: 'other', component: OtherComponent },
        ],
      },
    ]);

    const { window } = getGlobalContext();

    const router = createWebRouter({ routes });
    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));
    await runPendingSetupEffects();

    await router.navigate('/effect');

    expect(getTextContent(window.document.body)).toBe('Effect Component');
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();

    await router.navigate('/other');
    expect(getTextContent(window.document.body)).toBe('Other Component');
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    await router.navigate('/effect');
    expect(getTextContent(window.document.body)).toBe('Effect Component');
    expect(setupFn).toHaveBeenCalledTimes(2);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should clear the effects of a nested routing outlet if its parent is disposed', async () => {
    const setupFn = vi.fn();
    const cleanupFn = vi.fn();

    const EffectComponent = () => {
      useSetupEffect(() => {
        setupFn();
        return cleanupFn;
      });
      return <div>Effect Component</div>;
    };

    const ParentComponent = () => {
      return (
        <div>
          Hello world:
          <Outlet />
        </div>
      );
    };

    const App = () => {
      return (
        <div>
          <Outlet />
        </div>
      );
    };

    const routes = defineRoutes([
      {
        path: '/',
        component: App,
        children: [
          {
            path: 'parent',
            component: ParentComponent,
            children: [{ path: 'effect', component: EffectComponent }],
          },
        ],
      },
    ]);
    const { window } = getGlobalContext();

    const router = createWebRouter({ routes });
    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));

    await router.navigate('/parent');
    await runPendingSetupEffects();

    expect(getTextContent(window.document.body)).toBe('Hello world:');
    expect(setupFn).not.toHaveBeenCalled();

    await router.navigate('/parent/effect');
    await runPendingSetupEffects();

    expect(getTextContent(window.document.body)).toBe(
      'Hello world:Effect Component'
    );
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();

    await router.navigate('/parent');
    await runPendingSetupEffects();

    expect(getTextContent(window.document.body)).toBe('Hello world:');
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });
});
