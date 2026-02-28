import { getActiveRenderer, onSetup, runPendingSetupEffects } from 'retend';
import type { DOMRenderer } from 'retend-web';
import {
  Outlet,
  Router,
  createRouterRoot,
  defineRoutes,
  useRouter,
} from 'retend/router';
import { describe, expect, it, vi } from 'vitest';
import { getTextContent, routerSetupBrowser } from '../../setup.tsx';

describe('onSetup with routing', () => {
  routerSetupBrowser();

  it('should run setup and cleanup on navigation', async () => {
    const setupFn = vi.fn();
    const cleanupFn = vi.fn();

    const EffectComponent = () => {
      onSetup(() => {
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

    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const router = new Router({ routes });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));
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
      onSetup(() => {
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
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const router = new Router({ routes });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

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
