import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import { getTextContent, routerSetup } from '../setup.ts';
import { createWebRouter, defineRoutes, useRouter } from 'retend/router';

describe('Router Matching', () => {
  beforeEach(routerSetup);

  afterAll(() => {
    resetGlobalContext();
  });

  it('should match simple empty path', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/',
          name: 'home',
          children: [{ path: '', name: 'home-child', component: () => 'Home' }],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/');
    const route2 = router.getCurrentRoute();
    expect(route2.get().name).toBe('home-child');
  });

  it('should match empty path with nested fallthroughs', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/',
          name: 'home',
          children: [
            {
              path: '',
              name: 'home-child',
              children: [
                { path: '', name: 'home-child-child', component: () => 'Home' },
              ],
            },
            { path: 'about', name: 'about', component: () => 'About' },
          ],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/');
    const route2 = router.getCurrentRoute();
    expect(route2.get().name).toBe('home-child-child');
  });

  it('should match empty path in between nested fallthroughs', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/app',
          name: 'home',
          children: [
            {
              path: '',
              name: 'home-child',
              children: [
                { path: '/nested', name: 'nested', component: () => 'Nested' },
              ],
            },
          ],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/app');
    const route2 = router.getCurrentRoute();
    expect(route2.get().name).toBeNull(); // No resolvable component.

    await router.navigate('/app/nested');
    expect(route2.get().name).toBe('nested');
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
    expect(route.get().path).toBe('/home');
    expect(route.get().name).toBe('home');
  });

  it('should prioritize closest match', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/home', name: 'home', component: () => 'Home' },
        {
          path: '/home',
          name: 'home-alt',
          component: () => {
            const { Outlet } = useRouter();
            return (
              <>
                Home
                <Outlet />
              </>
            );
          },
          children: [
            { path: '/about', name: 'about-alt', component: () => 'About' },
          ],
        },
        { path: '/about', name: 'about', component: () => 'About' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home/about');
    const route = router.getCurrentRoute();
    expect(route.get().name).toBe('about-alt');
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
    const params = route.get().params;
    expect(Object.fromEntries(params.entries())).toEqual({ id: '123' });
    expect(route.get().name).toBe('user-detail');
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
    const params = route.get().params;
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
    expect(router.getCurrentRoute().get().name).toBeNull();
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
    const query = route.get().query;
    expect(query.get('q')).toBe('test');
    expect(query.get('page')).toBe('2');
    expect(route.get().fullPath).toBe('/search?q=test&page=2');

    expect(route.get().name).toBe('search');
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
    expect(route.get().fullPath).toBe('/article#section1');
    expect(route.get().name).toBe('article');
    expect(route.get().hash).toBe('section1');
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

    await router.navigate('/org/github/repo/retend');
    const route = router.getCurrentRoute();
    const params = route.get().params;
    expect(Object.fromEntries(params.entries())).toEqual({
      orgId: 'github',
      repoId: 'retend',
    });
    expect(route.get().name).toBe('repo');
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
    expect(route.get().name).toBe('not-found');
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
    expect(route.get().name).toBe('doc-catch-all');

    await router.navigate('/any/other/invalid/path');
    const route2 = router.getCurrentRoute();
    expect(route2.get().name).toBe('catch-all');
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
    expect(route.get().name).toBe('product-category');
    expect(route.get().params.get('category')).toBe('electronics');
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
    expect(route.get().name).toBe('not-found');
    expect(route.get().params.get('pathMatch')).toBe('very/deep/nested/path');
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
    expect(route.get().name).toBe('not-found');
    expect(route.get().params.get('pathMatch')).toBe('very');
    expect(route.get().params.get('pathMatch2')).toBe('nested/path');
  });

  it('should properly flush out nested child outlets', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'home',
        path: '/home',
        component: () => {
          const { Outlet } = useRouter();
          return (
            <>
              This is the home page. Content: <Outlet />
            </>
          );
        },
        children: [
          {
            name: 'info',
            path: 'info',
            component: () => {
              return <>This is the info page.</>;
            },
          },
        ],
      },
    ]);
    const router = createWebRouter({ routes });
    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/home');
    const route = router.getCurrentRoute();
    expect(route.get().name).toBe('home');
    expect(getTextContent(window.document.body)).toBe(
      'This is the home page. Content: '
    );

    await router.navigate('/home/info');
    expect(route.get().name).toBe('info');
    expect(getTextContent(window.document.body)).toBe(
      'This is the home page. Content: This is the info page.'
    );

    await router.navigate('/home');
    expect(route.get().name).toBe('home');
    expect(getTextContent(window.document.body)).toBe(
      'This is the home page. Content: '
    );
  });
});
