import { describe, it, expect, vi } from 'vitest';
import { runPendingSetupEffects, useSetupEffect } from 'retend';
import { createWebRouter, defineRoutes, useRouter } from 'retend/router';
import { getGlobalContext } from 'retend/context';
import { routerSetupBrowser, getTextContent } from '../../setup.ts';

describe('useSetupEffect with routing', () => {
  routerSetupBrowser();

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

  it('should run setup and cleanup on navigation', async () => {
    const { window } = getGlobalContext();
    setupFn.mockClear();
    cleanupFn.mockClear();

    const router = createWebRouter({ routes });
    router.setWindow(window);
    router.attachWindowListeners();
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
});
