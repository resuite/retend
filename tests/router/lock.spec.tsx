import type { DOMRenderer } from 'retend-web';

import { getActiveRenderer } from 'retend';
import { attachRouter } from 'retend-web';
import { Router, createRouterRoot, defineRoutes } from 'retend/router';
import { describe, expect, it, vi } from 'vitest';

import { getTextContent, routerSetupBrowser, vDomSetup } from '../setup.tsx';

describe('router.lock()', () => {
  vDomSetup();

  it('should prevent navigation when locked', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const Home = () => <div>Home</div>;
    const About = () => <div>About</div>;

    const routes = defineRoutes([
      { name: 'home', path: '/', component: Home },
      { name: 'about', path: '/about', component: About },
    ]);

    const router = new Router({ routes });
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(getTextContent(window.document.body)).toBe('Home');

    router.lock();
    await router.navigate('/about');

    expect(getTextContent(window.document.body)).toBe('Home');

    router.unlock();
    await router.navigate('/about');

    expect(getTextContent(window.document.body)).toBe('About');
  });

  it('routelockprevented event is dispatched when navigation is prevented by lock', async () => {
    const listener = vi.fn();
    const Home = () => <div>Home</div>;
    const About = () => <div>About</div>;

    const routes = defineRoutes([
      { name: 'home', path: '/', component: Home },
      { name: 'about', path: '/about', component: About },
    ]);

    const router = new Router({ routes });

    router.addEventListener('routelockprevented', listener);

    await router.navigate('/');
    router.lock();
    await router.navigate('/about');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].attemptedPath).toBe('/about');

    router.unlock();
    router.removeEventListener('routelockprevented', listener);
  });

  it('routelockprevented event is dispatched in replace() when navigation is prevented by lock', async () => {
    const listener = vi.fn();
    const Home = () => <div>Home</div>;
    const About = () => <div>About</div>;

    const routes = defineRoutes([
      { name: 'home', path: '/', component: Home },
      { name: 'about', path: '/about', component: About },
    ]);

    const router = new Router({ routes });

    router.addEventListener('routelockprevented', listener);

    await router.navigate('/');
    router.lock();
    await router.replace('/about');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].attemptedPath).toBe('/about');

    router.unlock();
    router.removeEventListener('routelockprevented', listener);
  });
});

describe('router.lock() attached to a window', () => {
  routerSetupBrowser();

  it('restores the locked URL when the user goes back while locked', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const Home = () => <div>Home</div>;
    const About = () => <div>About</div>;

    const routes = defineRoutes([
      { name: 'home', path: '/', component: Home },
      { name: 'about', path: '/about', component: About },
    ]);

    const router = new Router({ routes });
    const detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    await router.navigate('/about');
    expect(getTextContent(window.document.body)).toBe('About');

    router.lock();
    const prevented = new Promise<void>((resolve) => {
      router.addEventListener('routelockprevented', () => resolve(), {
        once: true,
      });
    });
    window.history.back();
    await prevented;

    expect(getTextContent(window.document.body)).toBe('About');
    expect(window.location.pathname).toBe('/about');

    router.unlock();
    detach();
  });
});
