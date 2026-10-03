import { onSetup } from 'retend';
import { Outlet, Router, RouterProvider } from 'retend/router';
import { afterEach, expect, it, vi } from 'vitest';

import { hotReloadModule } from '../source/plugins/hmr';
import {
  collectText,
  createRenderer,
  debugTree,
  disposeRenderers,
  tick,
} from './helpers';

afterEach(disposeRenderers);

it('keeps the router loaded after an HMR remount of the root', async () => {
  const renderer = createRenderer({ hmr: true });

  const makeRoot = (label: string) =>
    function Root() {
      const router = new Router({
        routes: [{ path: '/', component: () => label }],
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

  const RootV1 = makeRoot('V1');
  await renderer.mount(() => <RootV1 />);
  await tick();
  expect(collectText(debugTree(renderer))).toContain('V1');

  const RootV2 = makeRoot('V2');
  hotReloadModule({ default: RootV2 }, { default: RootV1 });
  await tick();
  expect(collectText(debugTree(renderer))).toContain('V2');
});

it('does not signal a window load for a nested boundary remount', async () => {
  const renderer = createRenderer({ hmr: true });
  const dispatch = vi.spyOn(renderer.host, 'dispatchEvent');
  const loadCount = () =>
    dispatch.mock.calls.filter(([event]) => event.type === 'load').length;

  function Child() {
    return <div>child</div>;
  }
  function Root() {
    onSetup(() => {
      renderer.host.dispatchEvent(new Event('load'));
    });
    return (
      <div>
        <Child />
      </div>
    );
  }

  await renderer.mount(() => <Root />);
  await tick();
  const loadsAfterMount = loadCount();

  function ChildV2() {
    return <div>child v2</div>;
  }
  hotReloadModule({ default: ChildV2 }, { default: Child });
  await tick();
  expect(loadCount()).toBe(loadsAfterMount);
});
