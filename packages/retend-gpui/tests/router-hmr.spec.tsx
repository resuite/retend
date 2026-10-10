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
        void router.navigate('/');
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

it('does not rerun root setup for a nested boundary remount', async () => {
  const renderer = createRenderer({ hmr: true });
  const rootSetup = vi.fn();

  function Child() {
    return <div>child</div>;
  }
  function Root() {
    onSetup(rootSetup);
    return (
      <div>
        <Child />
      </div>
    );
  }

  await renderer.mount(() => <Root />);
  await tick();
  const setupsAfterMount = rootSetup.mock.calls.length;

  function ChildV2() {
    return <div>child v2</div>;
  }
  hotReloadModule({ default: ChildV2 }, { default: Child });
  await tick();
  expect(collectText(debugTree(renderer))).toContain('child v2');
  expect(rootSetup).toHaveBeenCalledTimes(setupsAfterMount);
});
