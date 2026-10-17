import type { DOMRenderer } from 'retend-web';

import { getActiveRenderer } from 'retend';
import { attachRouter } from 'retend-web';
import {
  type AsyncRouteQuery,
  Router,
  createRouterRoot,
  defineRoutes,
  useRouteQuery,
} from 'retend/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTextContent, routerSetupBrowser } from '../setup.tsx';

const currentUrl = (window: Window) =>
  window.location.pathname + window.location.search + window.location.hash;

describe('attachRouter()', () => {
  routerSetupBrowser();

  let detach = () => {};
  afterEach(() => {
    detach();
    detach = () => {};
  });

  const createRouter = () =>
    new Router({
      routes: defineRoutes([
        { name: 'home', path: '/', component: () => 'Home' },
        { name: 'about', path: '/about', component: () => 'About' },
      ]),
    });

  it('pushes navigations and replaces replacements in browser history', async () => {
    const { host: window } = getActiveRenderer() as DOMRenderer;
    const router = createRouter();
    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(currentUrl(window)).toBe('/');
    const length = window.history.length;

    await router.navigate('/about?tab=team');
    expect(currentUrl(window)).toBe('/about?tab=team');
    expect(window.history.length).toBe(length + 1);

    await router.replace('/');
    expect(currentUrl(window)).toBe('/');
    expect(window.history.length).toBe(length + 1);
  });

  it('reflects route query changes in the URL', async () => {
    const { host: window } = getActiveRenderer() as DOMRenderer;
    //@ts-expect-error: assigned when the route renders.
    let query: AsyncRouteQuery = null;
    const CardPage = () => {
      query = useRouteQuery();
      return <div>Card</div>;
    };
    const router = new Router({
      routes: [{ name: 'card', path: '/card', component: CardPage }],
    });
    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/card?stage=design');
    expect(currentUrl(window)).toBe('/card?stage=design');

    await query.set('stage', 'development');
    expect(currentUrl(window)).toBe('/card?stage=development');

    await query.delete('stage');
    expect(currentUrl(window)).toBe('/card');
  });

  it('moves the browser back when the router goes back', async () => {
    const { host: window } = getActiveRenderer() as DOMRenderer;
    const router = createRouter();
    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    await router.navigate('/about');
    expect(currentUrl(window)).toBe('/about');

    await router.back();
    await vi.waitFor(() => {
      expect(currentUrl(window)).toBe('/');
    });
    expect(router.getCurrentRoute().get().fullPath).toBe('/');
    expect(getTextContent(window.document.body)).toBe('Home');
  });

  it('syncs the router when the user goes back in the browser', async () => {
    const { host: window } = getActiveRenderer() as DOMRenderer;
    const router = createRouter();
    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    await router.navigate('/about');
    expect(getTextContent(window.document.body)).toBe('About');

    window.history.back();
    await vi.waitFor(() => {
      expect(getTextContent(window.document.body)).toBe('Home');
    });
    expect(router.getCurrentRoute().get().fullPath).toBe('/');
    expect(currentUrl(window)).toBe('/');
  });

  it('stops touching the URL once detached', async () => {
    const { host: window } = getActiveRenderer() as DOMRenderer;
    const router = createRouter();
    detach = attachRouter(router, window);
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(currentUrl(window)).toBe('/');

    detach();
    await router.navigate('/about');
    expect(router.getCurrentRoute().get().fullPath).toBe('/about');
    expect(currentUrl(window)).toBe('/');
  });
});
