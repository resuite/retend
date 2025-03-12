import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { routerSetup } from '../setup.ts';
import { getGlobalContext, resetGlobalContext } from '@adbl/unfinished';
import { createWebRouter, type Router } from '@adbl/unfinished/router';

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
    expect(route.value.path).toBe('/about');

    await router.navigate('/about');
    expect(route.value.path).toBe('/about');
  });

  test('maintains history stack when navigating', async () => {
    const { window } = getGlobalContext();
    await router.navigate('/');
    await router.navigate('/about');
    await router.navigate('/contact');

    const history = window.sessionStorage.getItem('rhistory') as string;
    expect(JSON.parse(history)).toEqual(['/', '/about', '/contact']);
  });

  test('back navigation uses history stack', async () => {
    await router.navigate('/about');
    await router.navigate('/contact');
    router.back();

    const route = router.getCurrentRoute();
    expect(route.value.path).toBe('/about');
  });

  test('clears forward history on new navigation', async () => {
    const { window } = getGlobalContext();
    await router.navigate('/');
    await router.navigate('/about');
    await router.navigate('/contact');

    router.back();
    await router.navigate('/');

    const history = window.sessionStorage.getItem('rhistory') as string;
    expect(JSON.parse(history)).toEqual(['/']);
  });

  test('preserves params in history stack', async () => {
    await router.navigate('/about?id=123');
    await router.navigate('/contact');
    router.back();

    const { query } = router.getCurrentRoute().value;

    expect(query.get('id')).toBe('123');
  });
});
