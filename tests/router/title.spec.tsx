import type { DOMRenderer } from 'retend-web';

import { getActiveRenderer } from 'retend';
import { attachRouter } from 'retend-web';
import { Router, createRouterRoot, defineRoutes } from 'retend/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { routerSetupBrowser } from '../setup.tsx';

describe('Router Title Updates', () => {
  routerSetupBrowser();

  let detach = () => {};
  afterEach(() => {
    detach();
    detach = () => {};
  });

  it('should update window.document.title when navigating to routes with titles', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          name: 'home',
          path: '/',
          component: () => 'Home Page',
          title: 'Home Page Title',
        },
        {
          name: 'about',
          path: '/about',
          component: () => 'About Us',
          title: 'About Page Title',
        },
      ]),
    });

    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(window.document.title).toBe('Home Page Title');

    await router.navigate('/about');
    expect(window.document.title).toBe('About Page Title');
  });

  it('should update window.document.title when replacing routes with titles', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          name: 'home',
          path: '/',
          component: () => 'Home Page',
          title: 'Home Page Title',
        },
        {
          name: 'about',
          path: '/about',
          component: () => 'About Us',
          title: 'About Page Title',
        },
      ]),
    });

    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(window.document.title).toBe('Home Page Title');

    await router.replace('/about');
    expect(window.document.title).toBe('About Page Title');
    expect(window.location.pathname).toBe('/about');
  });

  it('should update window.document.title when traversing history', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          name: 'home',
          path: '/',
          component: () => 'Home Page',
          title: 'Home Page Title',
        },
        {
          name: 'about',
          path: '/about',
          component: () => 'About Us',
          title: 'About Page Title',
        },
      ]),
    });

    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    await router.navigate('/about');
    expect(window.document.title).toBe('About Page Title');

    window.history.back();
    await vi.waitFor(() => {
      expect(window.document.title).toBe('Home Page Title');
    });
    expect(router.getCurrentRoute().get().name).toBe('home');
  });

  it('should not update window.document.title if route has no title', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const initialTitle = window.document.title;
    const router = new Router({
      routes: defineRoutes([
        {
          name: 'home',
          path: '/',
          component: () => 'Home Page',
        },
        {
          name: 'about',
          path: '/about',
          component: () => 'About Us',
          title: 'About Page Title',
        },
      ]),
    });

    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(window.document.title).toBe(initialTitle);

    await router.navigate('/about');
    expect(window.document.title).toBe('About Page Title');
  });
});
