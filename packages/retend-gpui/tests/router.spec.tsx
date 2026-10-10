import { onSetup } from 'retend';
import { Outlet, Router, RouterProvider, defineRoutes } from 'retend/router';
import { afterEach, expect, it } from 'vitest';

import type { RetendGpuiRenderer } from '../source/gpui-renderer';

import { attachRouter } from '../source/router';
import { RuntimeGpuiWindow, WindowScope, useWindow } from '../source/window';
import {
  collectText,
  createRenderer,
  debugTree,
  disposeRenderers,
  tick,
} from './helpers';

afterEach(disposeRenderers);

function createWindow(renderer: RetendGpuiRenderer, initialPath: string) {
  return new RuntimeGpuiWindow({
    title: 'App',
    width: 800,
    height: 600,
    initialPath,
    renderer,
    runtime: {
      close() {},
      open: async () => {
        throw new Error('not used');
      },
    },
  });
}

it('renders a router outlet as a logical group', async () => {
  const renderer = createRenderer();
  const router = new Router({
    routes: [{ name: 'home', path: '/', component: () => 'Home' }],
  });
  await router.navigate('/');

  renderer.render(() => (
    <RouterProvider router={router}>
      <Outlet />
    </RouterProvider>
  ));
  expect(collectText(debugTree(renderer))).toContain('Home');
});

it('opens on the window initial path when attached in setup', async () => {
  const renderer = createRenderer();
  const window = createWindow(renderer, '/books/42');

  function Root() {
    const window = useWindow();
    const router = new Router({
      routes: [
        { name: 'home', path: '/', component: () => 'Home' },
        { name: 'book', path: '/books/:id', component: () => 'Book' },
      ],
    });
    onSetup(() => attachRouter(router, window));
    return (
      <RouterProvider router={router}>
        <Outlet />
      </RouterProvider>
    );
  }

  try {
    await renderer.mount(() =>
      WindowScope.Provider({ value: window, children: () => <Root /> })
    );
    await tick();
    expect(collectText(debugTree(renderer))).toContain('Book');
    expect(collectText(debugTree(renderer))).not.toContain('Home');
  } finally {
    window.dispose();
  }
});

it('sets the window title from route titles', async () => {
  const renderer = createRenderer();
  const window = createWindow(renderer, '/');
  const router = new Router({
    routes: defineRoutes([
      { name: 'home', path: '/', component: () => 'Home', title: 'Home' },
      {
        name: 'books',
        path: '/books',
        component: () => 'Books',
        title: 'Books',
      },
      { name: 'untitled', path: '/untitled', component: () => 'Untitled' },
    ]),
  });

  try {
    const detach = attachRouter(router, window);
    await tick();
    expect(window.title.get()).toBe('Home');

    await router.navigate('/books');
    expect(window.title.get()).toBe('Books');

    await router.navigate('/untitled');
    expect(window.title.get()).toBe('Books');

    await router.back();
    expect(window.title.get()).toBe('Books');

    detach();
    await router.navigate('/');
    expect(window.title.get()).toBe('Books');
  } finally {
    window.dispose();
  }
});
