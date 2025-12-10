import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { vDomSetup, getTextContent, routerRoot } from '../setup.tsx';
import { getGlobalContext } from 'retend/context';
import { createWebRouter, type Router, useRouter } from 'retend/router';

const runFlatTests = () => {
  let router: Router;

  beforeEach(() => {
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
    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));
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
};

const runNestedTests = () => {
  let router: Router;
  beforeEach(() => {
    const routes = [
      {
        name: 'home',
        path: '/',
        component() {
          const router = useRouter();
          return (
            <div>
              Nested Route: <router.Outlet />
            </div>
          );
        },
        children: [
          {
            name: 'base home route',
            path: '',
            component() {
              return 'On base home route.';
            },
          },
          {
            name: 'about',
            path: '/about',
            component: () => 'About',
          },
          {
            name: 'about',
            path: '/about/nested',
            component: () => 'Nested About (Flat)',
          },
          {
            name: 'contact',
            path: '/contact',
            component: () => 'Contact',
          },
        ],
      },
      {
        name: 'marketing',
        path: '/marketing',
        component: () => 'marketing',
      },
    ];
    const { window } = getGlobalContext();
    router = createWebRouter({
      routes,
      stackMode: true,
    });
    router.attachWindowListeners(window);
    window.document.body.append(routerRoot(router));
  });

  test('navigates properly in stack mode', async () => {
    const { window } = getGlobalContext();

    await router.navigate('/');
    expect(getTextContent(window.document.body)).toBe(
      'Nested Route: On base home route.'
    );
    await router.navigate('/about');
    expect(getTextContent(window.document.body)).toBe('Nested Route: About');
    await router.navigate('/about/nested');
    expect(getTextContent(window.document.body)).toBe(
      'Nested Route: Nested About (Flat)'
    );
  });

  test('has correct back and forward routes', async () => {
    const { window } = getGlobalContext();

    await router.navigate('/');
    expect(router.getCurrentRoute().get().fullPath).toBe('/');
    await router.navigate('/about');
    await router.navigate('/about/nested');
    await router.navigate('/contact');
    await router.navigate('/about/nested'); // pop back to ['/', '/about', '/about/nested']
    await router.back();
    expect(router.getCurrentRoute().get().fullPath).toBe('/about');
    expect(getTextContent(window.document.body)).toBe('Nested Route: About');
  });

  test('has correct params & query during navigation', async () => {
    const { window } = getGlobalContext();

    await router.navigate('/');
    await router.navigate('/about?value=1');
    await router.navigate('/about?value=2');
    await router.navigate('/about?value=3');
    await router.navigate('/about/nested');
    await router.navigate('/contact?value=3');
    await router.navigate('/marketing');
    await router.navigate('/about/nested'); // pop back to ['/', '/about?value=1', '/about?value=2', '/about?value=3', '/about/nested']
    await router.navigate('/contact?value=4');
    await router.navigate('/about?value=2'); // pop back to ['/', '/about?value=1', '/about?value=2']
    await router.back();
    expect(router.getCurrentRoute().get().fullPath).toBe('/about?value=1');
    expect(getTextContent(window.document.body)).toBe('Nested Route: About');
  });
};

describe('Router Stack Mode: Flat', () => {
  vDomSetup();
  runFlatTests();
});

describe('Router Stack Mode: Nested', () => {
  vDomSetup();
  runNestedTests();
});
