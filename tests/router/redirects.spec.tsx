import { describe, it, expect, vi } from 'vitest';
import { getTextContent, vDomSetup } from '../setup.tsx';
import { getActiveRenderer } from 'retend';
import type { DOMRenderer } from 'retend-web';
import { createRouterRoot, Router, defineRoutes } from 'retend/router';

describe('Router Redirects', () => {
  vDomSetup();

  it('should redirect from one path to another', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          path: '/old-path',
          name: 'old-path',
          redirect: '/new-path',
          component: () => 'Redirecting...',
        },
        { path: '/new-path', name: 'new-path', component: () => 'New Path' },
      ]),
    });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/old-path');
    const route = router.getCurrentRoute();
    expect(route.get().name).toBe('new-path');
    expect(route.get().fullPath).toBe('/new-path');
    expect(getTextContent(window.document.body)).toBe('New Path');
  });

  it('should handle redirect with path parameters', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          path: '/old/:id',
          name: 'old-path',
          redirect: '/new/:id',
          component: () => 'Redirecting...',
        },
        { path: '/new/:id', name: 'new-path', component: () => 'New Path' },
      ]),
    });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/old/123');
    const route = router.getCurrentRoute();
    expect(route.get().name).toBe('new-path');
    expect(route.get().fullPath).toBe('/new/123');
    expect(route.get().params.get('id')).toBe('123');
  });

  it('should handle nested route redirects', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          path: '/app',
          children: [
            {
              path: 'old',
              name: 'old-path',
              redirect: '/app/new',
              component: () => 'Redirecting...',
            },
            { path: 'new', name: 'new-path', component: () => 'New Path' },
          ],
        },
      ]),
    });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/app/old');
    const route = router.getCurrentRoute();
    expect(route.get().name).toBe('new-path');
    expect(route.get().fullPath).toBe('/app/new');
  });

  it('should prevent redirect loops', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const router = new Router({
      routes: defineRoutes([
        { path: '/a', name: 'a', redirect: '/b', component: () => 'A' },
        { path: '/b', name: 'b', redirect: '/a', component: () => 'B' },
      ]),
    });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/a');
    // Should not navigate and should warn about redirect loop
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('redirected too many times')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should ignore redirect to the same path', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          path: '/same',
          redirect: '/same',
          name: 'same',
          component: () => 'Same',
        },
      ]),
    });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/same');
    const route = router.getCurrentRoute();
    expect(route.get().name).toBe('same');
    expect(route.get().fullPath).toBe('/same');
  });

  it('should redirect with query parameters preserved', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          path: '/old',
          name: 'old-path',
          redirect: '/new',
          component: () => 'Redirecting...',
        },
        { path: '/new', name: 'new-path', component: () => 'New Path' },
      ]),
    });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/old?param=value');
    const route = router.getCurrentRoute();
    expect(route.get().name).toBe('new-path');
    expect(route.get().fullPath).toBe('/new?param=value');
    expect(route.get().query.get('param')).toBe('value');
  });

  it('should redirect with hash preserved', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        {
          path: '/old',
          name: 'old-path',
          redirect: '/new',
          component: () => 'Redirecting...',
        },
        { path: '/new', name: 'new-path', component: () => 'New Path' },
      ]),
    });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/old#section');
    const route = router.getCurrentRoute();
    expect(route.get().name).toBe('new-path');
    expect(route.get().fullPath).toBe('/new#section');
    expect(route.get().hash).toBe('section');
  });
});
