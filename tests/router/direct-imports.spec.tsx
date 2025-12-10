import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getGlobalContext, resetGlobalContext } from 'retend/context';
import { getTextContent, routerSetup } from '../setup.tsx';
import {
  createWebRouter,
  defineRoutes,
  Link,
  Outlet,
  Relay,
} from 'retend/router';

describe('Router Direct Imports', () => {
  beforeEach(routerSetup);

  afterAll(() => {
    resetGlobalContext();
  });

  it('should work with directly imported Link component', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/', name: 'home', component: () => 'Home' },
        { path: '/about', name: 'about', component: () => 'About' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    // Test that Link component can be used directly
    const linkElement = Link({
      href: '/about',
      children: 'About Link',
    }) as HTMLElement;
    expect(linkElement).toBeDefined();
    expect(linkElement.tagName.toLowerCase()).toBe('a');
    expect(linkElement.getAttribute('href')).toBe('/about');
    expect(getTextContent(linkElement)).toBe('About Link');
  });

  it('should work with directly imported Outlet component', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/', name: 'home', component: () => 'Home' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    // Test that Outlet component can be used directly
    const outletElement = Outlet() as HTMLElement;
    expect(outletElement).toBeDefined();
    expect(outletElement.tagName.toLowerCase()).toBe('retend-router-outlet');
  });

  it('should work with directly imported Relay component', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/', name: 'home', component: () => 'Home' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    // Test that Relay component can be used directly
    const relayElement = Relay({
      id: 'test-relay',
      source: () => 'Test Content',
    }) as HTMLElement;
    expect(relayElement).toBeDefined();
    expect(relayElement.tagName.toLowerCase()).toBe('retend-router-relay');
    expect(relayElement.getAttribute('data-x-relay-name')).toBe('test-relay');
  });

  it('should maintain backward compatibility with router instance methods', async () => {
    const { window } = getGlobalContext();
    const router = createWebRouter({
      routes: defineRoutes([
        { path: '/', name: 'home', component: () => 'Home' },
        { path: '/about', name: 'about', component: () => 'About' },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    // Test that router instance methods still work
    const linkElement = router.Link({
      href: '/about',
      children: 'About Link',
    }) as HTMLElement;
    expect(linkElement).toBeDefined();
    expect(linkElement.tagName.toLowerCase()).toBe('a');

    const outletElement = router.Outlet() as HTMLElement;
    expect(outletElement).toBeDefined();
    expect(outletElement.tagName.toLowerCase()).toBe('retend-router-outlet');

    const relayElement = router.Relay({
      id: 'test-relay',
      source: () => 'Test Content',
    }) as HTMLElement;
    expect(relayElement).toBeDefined();
    expect(relayElement.tagName.toLowerCase()).toBe('retend-router-relay');
  });

  it('should render components using direct imports in a real routing scenario', async () => {
    const { window } = getGlobalContext();

    const HomeComponent = () => {
      return (
        <div>
          <h1>Home Page</h1>
          <Link href="/about">Go to About</Link>
        </div>
      );
    };

    const AboutComponent = () => {
      return (
        <div>
          <h1>About Page</h1>
          <Link href="/">Go to Home</Link>
        </div>
      );
    };

    const LayoutComponent = () => {
      return (
        <div>
          <header>App Header</header>
          <main>
            <Outlet />
          </main>
          <footer>App Footer</footer>
        </div>
      );
    };

    const router = createWebRouter({
      routes: defineRoutes([
        {
          path: '/',
          name: 'layout',
          component: LayoutComponent,
          children: [
            { path: '', name: 'home', component: HomeComponent },
            { path: 'about', name: 'about', component: AboutComponent },
          ],
        },
      ]),
    });
    router.setWindow(window);
    router.attachWindowListeners();

    // Navigate to home
    await router.navigate('/');
    expect(getTextContent(window.document.body)).toContain('Home Page');
    expect(getTextContent(window.document.body)).toContain('App Header');
    expect(getTextContent(window.document.body)).toContain('App Footer');

    // Navigate to about
    await router.navigate('/about');
    expect(getTextContent(window.document.body)).toContain('About Page');
    expect(getTextContent(window.document.body)).toContain('App Header');
    expect(getTextContent(window.document.body)).toContain('App Footer');
  });
});
