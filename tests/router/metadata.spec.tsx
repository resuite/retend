import { describe, it, expect, beforeEach } from 'vitest';
import { setGlobalContext, getGlobalContext, Modes } from '@adbl/unfinished';
import { VWindow } from '@adbl/unfinished/v-dom';
import { createWebRouter, defineRoutes } from '@adbl/unfinished/router';
import { Cell } from '@adbl/cells';

describe('Router Metadata', () => {
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

  it('should contain correct metadata for current route', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'home',
        path: '/',
        component: () => 'Home Page',
        metadata: {
          title: 'Home Page',
          description: 'Welcome to the home page',
        },
      },
      {
        name: 'about',
        path: '/about',
        component: () => 'About Us',
        metadata: {
          title: 'About Us',
          description: 'Learn more about our company',
        },
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Home Page',
      description: 'Welcome to the home page',
    });

    await router.navigate('/about');

    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'About Us',
      description: 'Learn more about our company',
    });
  });

  it('should aggregate metadata from nested routes', async () => {
    const { window } = getGlobalContext() as { window: VWindow };

    const routes = defineRoutes([
      {
        name: 'dashboard',
        path: 'dashboard',
        component: () => (
          <div>
            dashboard
            <unfinished-router-outlet />
          </div>
        ),
        metadata: {
          section: 'Admin',
          requiresAuth: true,
        },
        children: [
          {
            name: 'users',
            path: 'users',
            component: () => <>This is the users route.</>,
            metadata: {
              title: 'User Management',
              permission: 'manage_users',
            },
          },
          {
            name: 'settings',
            path: 'settings',
            component: () => <>This is the settings route.</>,
            metadata: {
              title: 'System Settings',
              permission: 'manage_settings',
            },
          },
        ],
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/dashboard/users');
    expect(currentRoute.value.fullPath).toBe('/dashboard/users');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      section: 'Admin',
      requiresAuth: true,
      title: 'User Management',
      permission: 'manage_users',
    });

    await router.navigate('/dashboard/settings');
    expect(currentRoute.value.fullPath).toBe('/dashboard/settings');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      section: 'Admin',
      requiresAuth: true,
      title: 'System Settings',
      permission: 'manage_settings',
    });
  });

  it('should handle dynamic metadata based on route params', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'product-page',
        path: '/products/:id',
        component: () => 'Product Details',
        metadata: (data) => ({
          title: `Product ${data.params.get('id')}`,
          type: 'product-page',
        }),
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/products/123');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Product 123',
      type: 'product-page',
    });

    await router.navigate('/products/456');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Product 456',
      type: 'product-page',
    });
  });

  it('should update metadata when route params change', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'post-details',
        path: '/users/:userId/posts/:postId',
        component: () => 'Post Details',
        metadata: (data) => {
          const postId = data.params.get('postId');
          const userId = data.params.get('userId');
          return {
            title: `Post ${postId} by User ${userId}`,
            section: 'blog',
          };
        },
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/users/1/posts/100');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Post 100 by User 1',
      section: 'blog',
    });

    await router.navigate('/users/2/posts/200');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Post 200 by User 2',
      section: 'blog',
    });
  });

  it('should handle metadata with query parameters', async () => {
    const { window } = getGlobalContext();
    const routes = defineRoutes([
      {
        name: 'post-details',
        path: '/search',
        component: () => 'Search Results',
        metadata: (data) => ({
          title: `Search Results for: ${data.query.get('q')}`,
          type: 'search-page',
        }),
      },
    ]);

    const router = createWebRouter({ routes });
    const currentRoute = router.getCurrentRoute();
    const metadata = Cell.derived(() => currentRoute.value.metadata);

    router.setWindow(window);
    router.attachWindowListeners();

    await router.navigate('/search?q=javascript');
    expect(Object.fromEntries(metadata.value.entries())).toEqual({
      title: 'Search Results for: javascript',
      type: 'search-page',
    });
  });
});
