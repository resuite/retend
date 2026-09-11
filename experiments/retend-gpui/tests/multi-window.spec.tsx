import { onSetup } from 'retend';
import { Outlet, Router, RouterProvider } from 'retend/router';
import { afterEach, expect, it, vi } from 'vitest';

import type { RetendGpuiRenderer } from '../source/gpui-renderer';

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

  function createRoot(renderer: RetendGpuiRenderer, label: string) {
    return function Root() {
      const router = new Router({
        routes: [{ path: '/', component: () => label }],
        linkTag: 'div',
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
    };
  }

  await first.mount(createRoot(first, 'First'));
  await second.mount(createRoot(second, 'Second'));
  await tick();

  expect(collectText(debugTree(first))).toContain('First');
  expect(collectText(debugTree(second))).toContain('Second');
});
