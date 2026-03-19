import type { DOMRenderer } from 'retend-web';

import {
  createUnique,
  getActiveRenderer,
  runPendingSetupEffects,
} from 'retend';
import {
  Router,
  createRouterRoot,
  defineRoutes,
  useRouter,
} from 'retend/router';
import { describe, expect, it } from 'vitest';

import { getTextContent, routerSetupBrowser } from '../setup.tsx';

describe('Router Unique', () => {
  routerSetupBrowser();

  it('should move Unique components across routing layers and outlets', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const UniqueContent = createUnique(() => {
      return <>Unique Data</>;
    });
    const routes = defineRoutes([
      {
        name: 'parent',
        path: '/',
        component: () => {
          const { Outlet } = useRouter();
          return (
            <>
              Parent:[
              <UniqueContent id="unique-route" />]
              <Outlet />
            </>
          );
        },
        children: [
          {
            name: 'child',
            path: 'child',
            component: () => {
              const { Outlet } = useRouter();
              return (
                <>
                  Child:[
                  <Outlet />]
                </>
              );
            },
            children: [
              {
                name: 'child-index',
                path: '',
                component: () => <>Index</>,
              },
              {
                name: 'grandchild',
                path: 'grandchild',
                component: () => (
                  <>
                    Grandchild:[
                    <UniqueContent id="unique-route" />]
                  </>
                ),
              },
            ],
          },
        ],
      },
    ]);
    const router = new Router({ routes });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));
    await runPendingSetupEffects();

    await router.navigate('/child/grandchild');
    await runPendingSetupEffects();

    expect(getTextContent(window.document.body)).toBe(
      'Parent:[]Child:[Grandchild:[Unique Data]]'
    );
  });

  it('should keep Unique components in sync when routing back and forth through nested outlets', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const UniqueContent = createUnique(() => {
      return <>Unique Data</>;
    });
    const routes = defineRoutes([
      {
        name: 'parent',
        path: '/',
        component: () => {
          const { Outlet } = useRouter();
          return (
            <>
              Parent:[
              <UniqueContent id="unique-route" />]
              <Outlet />
            </>
          );
        },
        children: [
          {
            name: 'child',
            path: 'child',
            component: () => {
              const { Outlet } = useRouter();
              return (
                <>
                  Child:[
                  <Outlet />]
                </>
              );
            },
            children: [
              {
                name: 'child-index',
                path: '',
                component: () => <>Index</>,
              },
              {
                name: 'grandchild',
                path: 'grandchild',
                component: () => (
                  <>
                    Grandchild:[
                    <UniqueContent id="unique-route" />]
                  </>
                ),
              },
            ],
          },
        ],
      },
    ]);
    const router = new Router({ routes });
    router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));
    await runPendingSetupEffects();

    await router.navigate('/child/grandchild');
    await runPendingSetupEffects();
    expect(getTextContent(window.document.body)).toBe(
      'Parent:[]Child:[Grandchild:[Unique Data]]'
    );

    await router.navigate('/child');
    await runPendingSetupEffects();
    expect(getTextContent(window.document.body)).toBe(
      'Parent:[Unique Data]Child:[Index]'
    );

    await router.navigate('/child/grandchild');
    await runPendingSetupEffects();
    expect(getTextContent(window.document.body)).toBe(
      'Parent:[]Child:[Grandchild:[Unique Data]]'
    );
  });
});
