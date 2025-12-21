import { describe, it, expect } from 'vitest';
import { vDomSetup } from '../setup.tsx';
import { getActiveRenderer } from 'retend';
import type { DOMRenderer } from 'retend-web';
import { createRouterRoot, createWebRouter, defineRoutes } from 'retend/router';

describe('Router Title Updates', () => {
  vDomSetup();

  it('should update window.document.title when navigating to routes with titles', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = createWebRouter({
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

    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(window.document.title).toBe('Home Page Title');

    await router.navigate('/about');
    expect(window.document.title).toBe('About Page Title');
  });

  it('should not update window.document.title if route has no title', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const initialTitle = window.document.title;
    const router = createWebRouter({
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

    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(window.document.title).toBe(initialTitle);

    await router.navigate('/about');
    expect(window.document.title).toBe('About Page Title');
  });
});
