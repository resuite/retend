import { onSetup } from 'retend';
import { Outlet, Router, RouterProvider } from 'retend/router';
import { afterEach, expect, it } from 'vitest';

import {
  collectText,
  createRenderer,
  debugTree,
  disposeRenderers,
  tick,
} from './helpers';

afterEach(disposeRenderers);

it('renders a router outlet as a logical group', async () => {
  const renderer = createRenderer();
  const router = new Router({
    routes: [{ name: 'home', path: '/', component: () => 'Home' }],
  });
  const detach = router.attachWindowListeners(
    renderer.host as unknown as Window
  );
  await router.navigate('/');

  renderer.render(() => (
    <RouterProvider router={router}>
      <Outlet />
    </RouterProvider>
  ));
  expect(collectText(debugTree(renderer))).toContain('Home');

  detach();
});

it('loads the matched route when setup signals the window load', async () => {
  const renderer = createRenderer();
  function Root() {
    const router = new Router({
      routes: [{ name: 'home', path: '/', component: () => 'Home' }],
    });
    onSetup(() => {
      const detach = router.attachWindowListeners(
        renderer.host as unknown as Window
      );
      renderer.host.dispatchEvent(new Event('load'));
      return detach;
    });
    return (
      <RouterProvider router={router}>
        <Outlet />
      </RouterProvider>
    );
  }

  await renderer.mount(() => <Root />);
  await tick();
  expect(collectText(debugTree(renderer))).toContain('Home');
});
