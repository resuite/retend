import {
  type RouterMiddleware,
  Router,
  defineRouterMiddleware,
  defineRoutes,
  redirect,
} from 'retend/router';
import { describe, it, expect, vi } from 'vitest';

import { vDomSetup } from '../setup.tsx';

describe('Router Middlewares', () => {
  vDomSetup();

  it('should execute middleware before route change', async () => {
    const middlewareSpy = vi.fn();

    const testMiddleware: RouterMiddleware = defineRouterMiddleware(
      (details) => {
        middlewareSpy(details.to.path, details.from?.path);
      }
    );

    const router = new Router({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        { path: '/about', name: 'about', component: () => 'About' },
      ]),
      middlewares: [testMiddleware],
    });

    await router.navigate('/home');
    expect(middlewareSpy).toHaveBeenCalledWith('/home', '');

    await router.navigate('/about');
    expect(middlewareSpy).toHaveBeenCalledWith('/about', '/home');
  });

  it('should allow middleware to cancel navigation', async () => {
    const blockingMiddleware: RouterMiddleware = defineRouterMiddleware(
      (details) => {
        if (details.to.path === '/protected' && details.from) {
          return redirect(details.from.fullPath);
        }
        return;
      }
    );

    const router = new Router({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        { path: '/protected', name: 'protected', component: () => 'Protected' },
      ]),
      middlewares: [blockingMiddleware],
    });

    await router.navigate('/home');
    expect(router.getCurrentRoute().get().path).toBe('/home');

    await router.navigate('/protected');
    expect(router.getCurrentRoute().get().path).toBe('/home');
  });

  it('should chain multiple middlewares', async () => {
    const executionOrder: string[] = [];

    const firstMiddleware: RouterMiddleware = defineRouterMiddleware(() => {
      executionOrder.push('first');
    });

    const secondMiddleware: RouterMiddleware = defineRouterMiddleware(() => {
      executionOrder.push('second');
    });

    const router = new Router({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
      ]),
      middlewares: [firstMiddleware, secondMiddleware],
    });

    await router.navigate('/home');
    expect(executionOrder).toEqual(['first', 'second']);
  });

  it('should allow middleware to modify route', async () => {
    const redirectMiddleware = defineRouterMiddleware((details) => {
      if (details.to.path === '/new-path' && details.from) {
        return redirect(details.from.fullPath);
      }
      return;
    });

    const router = new Router({
      routes: defineRoutes([
        { path: '/old-path', name: 'old', component: () => 'Old' },
        { path: '/new-path', name: 'new', component: () => 'New' },
      ]),
      middlewares: [redirectMiddleware],
    });

    await router.navigate('/old-path');
    await router.navigate('/new-path');
    expect(router.getCurrentRoute().get().path).toBe('/old-path');
  });

  it('should rematch route data after middleware redirects', async () => {
    const observedRouteData: Array<{
      name: string | null;
      path: string;
      fullPath: string;
      id: string | undefined;
    }> = [];

    const redirectMiddleware = defineRouterMiddleware((details) => {
      if (details.to.fullPath === '/private/123') {
        return redirect('/login');
      }
      return;
    });
    const observingMiddleware = defineRouterMiddleware((details) => {
      observedRouteData.push({
        name: details.to.name,
        path: details.to.path,
        fullPath: details.to.fullPath,
        id: details.to.params.get('id'),
      });
    });

    const router = new Router({
      routes: defineRoutes([
        { path: '/private/:id', name: 'private', component: () => 'Private' },
        { path: '/login', name: 'login', component: () => 'Login' },
      ]),
      middlewares: [redirectMiddleware, observingMiddleware],
    });

    await router.navigate('/private/123');
    expect(router.getCurrentRoute().get().name).toBe('login');
    expect(observedRouteData.length).toBeGreaterThan(0);
    expect(
      observedRouteData.every(
        (routeData) =>
          routeData.name === 'login' &&
          routeData.path === '/login' &&
          routeData.fullPath === '/login' &&
          routeData.id === undefined
      )
    ).toBe(true);
  });

  it('should handle async middleware operations', async () => {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const asyncMiddleware: RouterMiddleware = defineRouterMiddleware(
      async () => {
        await delay(50);
      }
    );

    const router = new Router({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
      ]),
      middlewares: [asyncMiddleware],
    });

    await router.navigate('/home');
    expect(router.getCurrentRoute().get().path).toBe('/home');
  });

  it('should provide route metadata to middleware', async () => {
    const metadataSpy = vi.fn();

    const metadataMiddleware = defineRouterMiddleware((details) => {
      metadataSpy(details.to.name, details.to.params, details.to.query);
      return;
    });

    const router = new Router({
      routes: defineRoutes([
        {
          path: '/user/:id',
          name: 'user',
          component: () => 'User',
        },
      ]),
      middlewares: [metadataMiddleware],
    });

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
