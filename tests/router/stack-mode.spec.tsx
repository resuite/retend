import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { routerSetup } from '../setup.ts';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import { createWebRouter, type Router } from 'retend/router';

describe('Router Stack Mode', () => {
  let router: Router;

  beforeEach(() => {
    routerSetup();
    const { window } = getGlobalContext();
    router = createWebRouter({
      routes: [
        {
          name: 'home',
          path: '/',
          component: () => 'Home',
        },
        {
          name: 'about',
          path: '/about',
          component: () => 'About',
        },
        {
          name: 'contact',
          path: '/contact',
          component: () => 'Contact',
        },
      ],
      stackMode: true,
    });
    router.setWindow(window);
    router.attachWindowListeners();
  });

  afterAll(() => {
    resetGlobalContext();
  });

  test('navigates to the same route', async () => {
    await router.navigate('/about');
    const route = router.getCurrentRoute();
    expect(route.get().path).toBe('/about');

    await router.navigate('/about');
    expect(route.get().path).toBe('/about');
  });

  test('back navigation uses history stack', async () => {
    await router.navigate('/about');
    await router.navigate('/contact');
    await router.back();

    const route = router.getCurrentRoute();
    expect(route.get().path).toBe('/about');
  });

  test('preserves params in history stack', async () => {
    await router.navigate('/about?id=123');
    await router.navigate('/contact');
    await router.back();

    const { query } = router.getCurrentRoute().get();

    expect(query.get('id')).toBe('123');
  });
});
