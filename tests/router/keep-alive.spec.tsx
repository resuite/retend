import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import { createWebRouter, defineRoutes, useRouter } from 'retend/router';
import { routerSetup, getTextContent } from '../setup.ts';

describe('Keep Alive Outlet', () => {
  beforeEach(() => {
    routerSetup();
  });

  afterAll(() => {
    resetGlobalContext();
  });

  it('should keep the component alive and not re-render it on navigation', async () => {
    const { window } = getGlobalContext();
    const renderSpy = vi.fn();

    const App = () => {
      const { Outlet } = useRouter();
      return (
        <div>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <Outlet keepAlive />
        </div>
      );
    };

    const Home = () => {
      renderSpy();
      return <div>Home Content</div>;
    };

    const About = () => <div>About Content</div>;

    const routes = defineRoutes([
      {
        name: 'app',
        path: '/',
        component: App, // Render into base outlet from setup.
        children: [
          { path: '', name: 'home', component: Home },
          { path: 'about', name: 'about', component: About },
        ],
      },
    ]);

    const router = createWebRouter({ routes });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/');
    expect(renderSpy).toHaveBeenCalledTimes(1);

    await router.navigate('/about');
    expect(renderSpy).toHaveBeenCalledTimes(1);

    await router.navigate('/');
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('should preserve nested child routes', async () => {
    const { window } = getGlobalContext();
    const nestedComponentRenderSpy = vi.fn();
    const otherNestedComponentRenderSpy = vi.fn();

    const NestedComponent = () => {
      nestedComponentRenderSpy();
      return <div>This is nested content.</div>;
    };

    const OtherNestedComponent = () => {
      otherNestedComponentRenderSpy();
      return <div>Hello world!</div>;
    };

    const App = () => {
      const { Outlet } = useRouter();
      return (
        <>
          This is app content.
          <Outlet keepAlive />
        </>
      );
    };

    const routes = defineRoutes([
      {
        path: '/',
        name: 'App',
        component: App,
        children: [
          {
            name: 'Nested Page',
            path: 'nested',
            component: NestedComponent,
          },
          {
            name: 'Other Nested Page',
            path: 'other-nested',
            component: OtherNestedComponent,
          },
        ],
      },
    ]);
    const router = createWebRouter({ routes });
    router.setWindow(window);

    await router.navigate('/');
    expect(nestedComponentRenderSpy).toHaveBeenCalledTimes(0);
    expect(otherNestedComponentRenderSpy).toHaveBeenCalledTimes(0);
    expect(getTextContent(window.document.body)).toBe('This is app content.');

    await router.navigate('/nested');
    expect(nestedComponentRenderSpy).toHaveBeenCalledTimes(1);
    expect(getTextContent(window.document.body)).toBe(
      'This is app content.This is nested content.'
    );

    await router.navigate('/other-nested');
    expect(otherNestedComponentRenderSpy).toHaveBeenCalledTimes(1);
    expect(getTextContent(window.document.body)).toBe(
      'This is app content.Hello world!'
    );

    await router.navigate('/nested');
    expect(nestedComponentRenderSpy).toHaveBeenCalledTimes(1); // From cache.
    expect(getTextContent(window.document.body)).toBe(
      'This is app content.This is nested content.'
    );

    await router.navigate('/other-nested');
    expect(otherNestedComponentRenderSpy).toHaveBeenCalledTimes(1); // From cache.
    expect(getTextContent(window.document.body)).toBe(
      'This is app content.Hello world!'
    );
  });

  it('should preserve scroll position of the outlet when navigating back', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        path: '/',
        name: 'home',
        component: () => (
          <div style={{ height: '2000px' }}>Home Content (long page)</div>
        ),
      },
      { path: '/about', name: 'about', component: () => <div>About</div> },
    ]);

    const router = createWebRouter({ routes });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/');

    window.document.documentElement.scrollTop = 500; // Scroll down a bit

    await router.navigate('/about');
    await router.navigate('/'); // Go back

    expect(window.document.documentElement.scrollTop).toBe(500); // Scroll position should be restored
  });

  it('should respect maxKeepAliveCount', async () => {
    const { window } = getGlobalContext();
    const renderSpy1 = vi.fn();
    const renderSpy2 = vi.fn();
    const renderSpy3 = vi.fn();

    const Route1 = () => {
      renderSpy1();
      return <div>Route 1</div>;
    };
    const Route2 = () => {
      renderSpy2();
      return <div>Route 2</div>;
    };
    const Route3 = () => {
      renderSpy3();
      return <div>Route 3</div>;
    };
    const Route4 = () => {
      return <div>Route 4</div>;
    };

    const App = () => {
      const { Outlet } = useRouter();
      return (
        <div>
          <a href="/1">1</a>
          <a href="/2">2</a>
          <a href="/3">3</a>
          <a href="/4">4</a>
          <Outlet keepAlive maxKeepAliveCount={2} />
        </div>
      );
    };

    const routes = defineRoutes([
      {
        name: 'App',
        path: '/',
        component: App,
        children: [
          { path: '/1', name: 'route1', component: Route1 },
          { path: '/2', name: 'route2', component: Route2 },
          { path: '/3', name: 'route3', component: Route3 },
          { path: '/4', name: 'route4', component: Route4 },
        ],
      },
    ]);

    const router = createWebRouter({ routes });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/1');
    expect(renderSpy1).toHaveBeenCalledTimes(1);

    await router.navigate('/2');
    expect(renderSpy2).toHaveBeenCalledTimes(1);

    await router.navigate('/3');
    expect(renderSpy3).toHaveBeenCalledTimes(1);

    await router.navigate('/4');

    await router.navigate('/1');
    expect(renderSpy1).toHaveBeenCalledTimes(2); // Route 1 was evicted and re-rendered

    await router.navigate('/3');
    expect(renderSpy3).toHaveBeenCalledTimes(1); // Route 2 kept alive
  });
});
