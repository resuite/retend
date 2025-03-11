import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setGlobalContext, Modes, getGlobalContext } from '@adbl/unfinished';
import { VWindow } from '@adbl/unfinished/v-dom';
import {
  createWebRouter,
  defineRoutes,
  useRouter,
} from '@adbl/unfinished/router';

describe('Router Matching', () => {
  beforeEach(() => {
    const window = new VWindow();
    window.document.body.append(
      window.document.createElement('unfinished-router-outlet')
    );

    setGlobalContext({
      mode: Modes.VDom,
      window,
      consistentValues: new Map(),
      teleportIdCounter: { value: 0 },
    });
  });

  it('should match exact path', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        { path: '/about', name: 'about', component: () => 'About' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home');
    const route = router.getCurrentRoute();
    expect(route.value.path).toBe('/home');
    expect(route.value.name).toBe('home');
  });

  it('should match path parameters', async () => {
    const { window } = getGlobalContext();
    const callback = vi.fn();
    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/users/:id',
          name: 'user-detail',
          component: () => {
            const router = useRouter();
            const id = router.params.get('id');
            callback(id);
            return <>User {id}</>;
          },
        },
      ]),
    });

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/users/123');
    const route = router.getCurrentRoute();
    const params = route.value.params;
    expect(Object.fromEntries(params.entries())).toEqual({ id: '123' });
    expect(route.value.name).toBe('user-detail');
    expect(callback).toHaveBeenCalledWith('123');
    expect(callback).toHaveBeenCalledTimes(1);

    await router.navigate('/users/456');
    expect(callback).toHaveBeenCalledWith('456');
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should match nested routes', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/posts',
          name: 'posts',
          component: () => 'Posts',
          children: [
            {
              path: ':id',
              name: 'post-detail',
              component: () => 'Post Detail',
            },
          ],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/posts/456');
    const route = router.getCurrentRoute();
    const params = route.value.params;
    expect(Object.fromEntries(params.entries())).toEqual({ id: '456' });
  });

  it('should not match invalid paths', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/invalid');
    expect(router.getCurrentRoute().value.name).toBeNull();
  });

  it('should handle query parameters', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/search', name: 'search', component: () => 'Search' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/search?q=test&page=2');
    const route = router.getCurrentRoute();
    const query = route.value.query;
    expect(query.get('q')).toBe('test');
    expect(query.get('page')).toBe('2');
    expect(route.value.fullPath).toBe('/search?q=test&page=2');

    expect(route.value.name).toBe('search');
  });

  it('should handle hash fragments', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/article', name: 'article', component: () => 'Article' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/article#section1');
    const route = router.getCurrentRoute();
    expect(route.value.fullPath).toBe('/article#section1');
    expect(route.value.name).toBe('article');
    expect(route.value.hash).toBe('section1');
  });

  it('should match multiple path parameters', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/org/:orgId/repo/:repoId',
          name: 'repo',
          component: () => 'Repo',
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/org/github/repo/unfinished');
    const route = router.getCurrentRoute();
    const params = route.value.params;
    expect(Object.fromEntries(params.entries())).toEqual({
      orgId: 'github',
      repoId: 'unfinished',
    });
    expect(route.value.name).toBe('repo');
  });

  it('should match wildcard routes', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        { path: '*', name: 'not-found', component: () => '404' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/non/existent/path');
    const route = router.getCurrentRoute();
    expect(route.value.name).toBe('not-found');
  });

  it('should match nested wildcard routes', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/docs',
          name: 'docs',
          component: () => {
            const { Outlet } = useRouter();
            return (
              <>
                There is the docs page.
                <Outlet />
              </>
            );
          },
          children: [
            { path: '*', name: 'doc-catch-all', component: () => 'Doc Page' },
          ],
        },
        {
          path: '*',
          name: 'catch-all',
          component: () => '404',
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/docs/any/nested/path');
    const route = router.getCurrentRoute();
    expect(route.value.name).toBe('doc-catch-all');

    await router.navigate('/any/other/invalid/path');
    const route2 = router.getCurrentRoute();
    expect(route2.value.name).toBe('catch-all');
  });

  it('should match wildcard with parameters', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/products/:category/*',
          name: 'product-category',
          component: () => 'Products',
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/products/electronics/phones/android');
    const route = router.getCurrentRoute();
    expect(route.value.name).toBe('product-category');
    expect(route.value.params.get('category')).toBe('electronics');
  });

  it('should handle deep catch-all routes', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        {
          path: '/:pathMatch*',
          name: 'not-found',
          component: () => '404',
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/very/deep/nested/path');
    const route = router.getCurrentRoute();
    expect(route.value.name).toBe('not-found');
    expect(route.value.params.get('pathMatch')).toBe('very/deep/nested/path');
  });

  it('should match nested deep catch-all routes', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        {
          path: '/:pathMatch/deep',
          name: 'not-found-top',
          component: () => {
            const router = useRouter();
            return (
              <>
                404
                <router.Outlet />
              </>
            );
          },
          children: [
            {
              path: '/:pathMatch2*',
              name: 'not-found',
              component: () => <>404</>,
            },
          ],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/very/deep/nested/path');
    const route = router.getCurrentRoute();
    expect(route.value.name).toBe('not-found');
    expect(route.value.params.get('pathMatch')).toBe('very');
    expect(route.value.params.get('pathMatch2')).toBe('nested/path');
  });
});
