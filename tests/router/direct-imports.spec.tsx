import { describe, it, expect } from 'vitest';
import { getActiveRenderer } from 'retend';
import type { DOMRenderer } from 'retend-web';
import { vDomSetup, getTextContent } from '../setup.tsx';
import {
  createRouterRoot,
  Router,
  defineRoutes,
  Link,
  Outlet,
  RouterProvider,
} from 'retend/router';

describe('Router Direct Imports', () => {
  vDomSetup();

  it('should work with directly imported Link component', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        { path: '/', name: 'home', component: () => 'Home' },
        { path: '/about', name: 'about', component: () => 'About' },
      ]),
    });
    router.attachWindowListeners(window);

    RouterProvider({
      router,
      children: () => {
        // Test that Link component can be used directly
        const linkElement = Link({
          href: '/about',
          children: 'About Link',
        }) as HTMLElement;
        expect(linkElement).toBeDefined();
        expect(linkElement.tagName.toLowerCase()).toBe('a');
        expect(linkElement.getAttribute('href')).toBe('/about');
        expect(getTextContent(linkElement)).toBe('About Link');
      },
    });
  });

  it('should work with directly imported Outlet component', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        { path: '/', name: 'home', component: () => 'Home' },
      ]),
    });
    router.attachWindowListeners(window);

    // Test that Outlet component can be used directly
    RouterProvider({
      router,
      children: () => {
        const outletElement = Outlet() as HTMLElement;
        expect(outletElement).toBeDefined();
        expect(outletElement.tagName.toLowerCase()).toBe(
          'retend-router-outlet'
        );
      },
    });
  });

  it('should maintain backward compatibility with router instance methods', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const router = new Router({
      routes: defineRoutes([
        { path: '/', name: 'home', component: () => 'Home' },
        { path: '/about', name: 'about', component: () => 'About' },
      ]),
    });
    router.attachWindowListeners(window);

    RouterProvider({
      router,
      children: () => {
        // Test that router instance methods still work
        const linkElement = router.Link({
          href: '/about',
          children: 'About Link',
        }) as HTMLElement;
        expect(linkElement).toBeDefined();
        expect(linkElement.tagName.toLowerCase()).toBe('a');

        const outletElement = router.Outlet() as HTMLElement;
        expect(outletElement).toBeDefined();
        expect(outletElement.tagName.toLowerCase()).toBe(
          'retend-router-outlet'
        );
      },
    });
  });

  it('should render components using direct imports in a real routing scenario', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

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

    const router = new Router({
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
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));

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
