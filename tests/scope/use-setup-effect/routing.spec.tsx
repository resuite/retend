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

  const App = (props: { keepAlive?: boolean }) => {
    const { Outlet } = useRouter();
    return (
      <div>
        <Outlet keepAlive={props.keepAlive} />
      </div>
    );
  };

  const routes = (props: { keepAlive?: boolean }) =>
    defineRoutes([
      {
        path: '/',
        component: () => <App {...props} />,
        children: [
          { path: 'effect', component: EffectComponent },
          { path: 'other', component: OtherComponent },
        ],
      },
    ]);

  it('should run setup and cleanup on navigation (keepAlive=false)', async () => {
    const { window } = getGlobalContext();
    setupFn.mockClear();
    cleanupFn.mockClear();

    const router = createWebRouter({ routes: routes({ keepAlive: false }) });
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

  it('should dispose and re-run effects with keepAlive=true', async () => {
    const { window } = getGlobalContext();
    setupFn.mockClear();
    cleanupFn.mockClear();

    const router = createWebRouter({ routes: routes({ keepAlive: true }) });
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
