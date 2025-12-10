import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import { routerSetup } from '../setup.tsx';
import {
  createWebRouter,
  defineRouterMiddleware,
  defineRoutes,
  redirect,
} from 'retend/router';
import type { RouterMiddleware } from 'retend/router';

describe('Router Middlewares', () => {
  beforeEach(routerSetup);

  afterAll(() => {
    resetGlobalContext();
  });

  it('should execute middleware before route change', async () => {
    const { window } = getGlobalContext();
    const middlewareSpy = vi.fn();

    const testMiddleware: RouterMiddleware = defineRouterMiddleware(
      (details) => {
        middlewareSpy(details.to.path, details.from?.path);
      }
    );

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        { path: '/about', name: 'about', component: () => 'About' },
      ]),
      middlewares: [testMiddleware],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home');
    expect(middlewareSpy).toHaveBeenCalledWith('/home', '');

    await router.navigate('/about');
    expect(middlewareSpy).toHaveBeenCalledWith('/about', '/home');
  });

  it('should allow middleware to cancel navigation', async () => {
    const { window } = getGlobalContext();
    const blockingMiddleware: RouterMiddleware = defineRouterMiddleware(
      (details) => {
        if (details.to.path === '/protected' && details.from) {
          return redirect(details.from.fullPath);
        }
        return;
      }
    );

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        { path: '/protected', name: 'protected', component: () => 'Protected' },
      ]),
      middlewares: [blockingMiddleware],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home');
    expect(router.getCurrentRoute().get().path).toBe('/home');

    await router.navigate('/protected');
    expect(router.getCurrentRoute().get().path).toBe('/home');
  });

  it('should chain multiple middlewares', async () => {
    const { window } = getGlobalContext();
    const executionOrder: string[] = [];

    const firstMiddleware: RouterMiddleware = defineRouterMiddleware(() => {
      executionOrder.push('first');
    });

    const secondMiddleware: RouterMiddleware = defineRouterMiddleware(() => {
      executionOrder.push('second');
    });

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
      ]),
      middlewares: [firstMiddleware, secondMiddleware],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home');
    expect(executionOrder).toEqual(['first', 'second']);
  });

  it('should allow middleware to modify route', async () => {
    const { window } = getGlobalContext();
    const redirectMiddleware = defineRouterMiddleware((details) => {
      if (details.to.path === '/new-path' && details.from) {
        return redirect(details.from.fullPath);
      }
      return;
    });

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/old-path', name: 'old', component: () => 'Old' },
        { path: '/new-path', name: 'new', component: () => 'New' },
      ]),
      middlewares: [redirectMiddleware],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/old-path');
    await router.navigate('/new-path');
    expect(router.getCurrentRoute().get().path).toBe('/old-path');
  });

  it('should handle async middleware operations', async () => {
    const { window } = getGlobalContext();
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const asyncMiddleware: RouterMiddleware = defineRouterMiddleware(
      async () => {
        await delay(50);
      }
    );

    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
      ]),
      middlewares: [asyncMiddleware],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home');
    expect(router.getCurrentRoute().get().path).toBe('/home');
  });

  it('should provide route metadata to middleware', async () => {
    const { window } = getGlobalContext();
    const metadataSpy = vi.fn();

    const metadataMiddleware = defineRouterMiddleware((details) => {
      metadataSpy(details.to.name, details.to.params, details.to.query);
      return;
    });

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/user/:id',
          name: 'user',
          component: () => 'User',
        },
      ]),
      middlewares: [metadataMiddleware],
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/user/123?tab=profile');
    expect(metadataSpy).toHaveBeenCalledWith(
      'user',
      expect.any(Map),
      expect.any(URLSearchParams)
    );

    const [, params, query] = metadataSpy.mock.calls[0];
    expect(params.get('id')).toBe('123');
    expect(query.get('tab')).toBe('profile');
  });
});
