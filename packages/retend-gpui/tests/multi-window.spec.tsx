import { onSetup } from 'retend';
import { Outlet, Router, RouterProvider } from 'retend/router';
import { afterEach, expect, it, vi } from 'vitest';

import {
  collectText,
  createRenderer,
  debugTree,
  disposeRenderers,
  tick,
} from './helpers';

afterEach(disposeRenderers);

it('runs setup effects for a second mounted root', async () => {
  const first = createRenderer();
  const second = createRenderer();
  const firstSetup = vi.fn();
  const secondSetup = vi.fn();

  function First() {
    onSetup(firstSetup);
    return <div>first</div>;
  }
  function Second() {
    onSetup(secondSetup);
    return <div>second</div>;
  }

  await first.mount(() => <First />);
  await second.mount(() => <Second />);

  expect(firstSetup).toHaveBeenCalledTimes(1);
  expect(secondSetup).toHaveBeenCalledTimes(1);
});

it('loads a router in each mounted root', async () => {
  const first = createRenderer();
  const second = createRenderer();

  function createRoot(label: string) {
    return function Root() {
      const router = new Router({
        routes: [{ path: '/', component: () => label }],
        linkTag: 'div',
      });
      onSetup(() => {
        void router.navigate('/');
      });
      return (
        <RouterProvider router={router}>
          <Outlet />
        </RouterProvider>
      );
    };
  }

  await first.mount(createRoot('First'));
  await second.mount(createRoot('Second'));
  await tick();

  expect(collectText(debugTree(first))).toContain('First');
  expect(collectText(debugTree(second))).toContain('Second');
});
