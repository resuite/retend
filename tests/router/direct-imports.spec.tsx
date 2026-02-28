import { getActiveRenderer } from 'retend';
import type { DOMRenderer } from 'retend-web';
import {
  Link,
  Outlet,
  Router,
  RouterProvider,
  createRouterRoot,
  defineRoutes,
} from 'retend/router';
import { describe, expect, it } from 'vitest';
import { getTextContent, vDomSetup } from '../setup.tsx';

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
    const Component = () => {
      // Test that Link component can be used directly
      const linkElement = renderer.render(
        Link({
          href: '/about',
          children: 'About Link',
        })
      ) as HTMLElement;
      expect(linkElement).toBeDefined();
      expect(linkElement.tagName.toLowerCase()).toBe('a');
      expect(linkElement.getAttribute('href')).toBe('/about');
      expect(getTextContent(linkElement)).toBe('About Link');

      return <></>;
    };

    renderer.render(
      <RouterProvider router={router}>
        <Component />
      </RouterProvider>
    );
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
    const Component = () => {
      const outletElement = renderer.render(Outlet()) as HTMLElement;
      expect(outletElement).toBeDefined();
      expect(outletElement.tagName.toLowerCase()).toBe('retend-router-outlet');

      return <></>;
    };

    renderer.render(
      <RouterProvider router={router}>
        <Component />
      </RouterProvider>
    );
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
    const Component = () => {
      const linkElement = renderer.render(
        router.Link({
          href: '/about',
          children: 'About Link',
        })
      ) as HTMLElement;
      expect(linkElement).toBeDefined();
      expect(linkElement.tagName.toLowerCase()).toBe('a');

      const outletElement = renderer.render(router.Outlet()) as HTMLElement;
      expect(outletElement).toBeDefined();
      expect(outletElement.tagName.toLowerCase()).toBe('retend-router-outlet');

      return <></>;
    };

    renderer.render(
      <RouterProvider router={router}>
        <Component />
      </RouterProvider>
    );
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

    await router.navigate('/');
    expect(getTextContent(window.document.body)).toContain('Home Page');
    expect(getTextContent(window.document.body)).toContain('App Header');
    expect(getTextContent(window.document.body)).toContain('App Footer');

    await router.navigate('/about');
    expect(getTextContent(window.document.body)).toContain('About Page');
    expect(getTextContent(window.document.body)).toContain('App Header');
    expect(getTextContent(window.document.body)).toContain('App Footer');
  });
});
