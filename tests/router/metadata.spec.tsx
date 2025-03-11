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
    const metadata = Cell.derived(() => {
      return currentRoute.value.metadata;
    });

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
});
