import type { DOMRenderer } from 'retend-web';

import { getActiveRenderer } from 'retend';
import { Router, createRouterRoot, defineRoutes } from 'retend/router';
import { describe, expect, it, vi } from 'vitest';

import { getTextContent, vDomSetup } from '../setup.tsx';

describe('router.sync()', () => {
  vDomSetup();

  it('adopts an external URL change without emitting routeloadcompleted', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const loadCompleted = vi.fn();
    const router = new Router({
      routes: defineRoutes([
        { name: 'home', path: '/', component: () => 'Home' },
        { name: 'about', path: '/about', component: () => 'About' },
      ]),
    });
    window.document.body.append(createRouterRoot(router));

    await router.navigate('/');
    expect(getTextContent(window.document.body)).toBe('Home');
    router.addEventListener('routeloadcompleted', loadCompleted);

    // The host URL changed independently of the router.
    await router.sync('/about');

    expect(router.getCurrentRoute().get().fullPath).toBe('/about');
    expect(getTextContent(window.document.body)).toBe('About');
    expect(loadCompleted).not.toHaveBeenCalled();

    router.removeEventListener('routeloadcompleted', loadCompleted);
  });
});
