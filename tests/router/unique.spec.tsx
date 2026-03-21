import type { DOMRenderer } from 'retend-web';

import {
  Cell,
  If,
  createUnique,
  getActiveRenderer,
  onSetup,
  runPendingSetupEffects,
} from 'retend';
import { UniqueTransition } from 'retend-utils/components';
import {
  Router,
  createRouterRoot,
  defineRoutes,
  useCurrentRoute,
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

  it('should move a setup-driven Unique into the child outlet on direct entry in stack mode', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;

    const Stage = createUnique(() => {
      const route = useCurrentRoute();
      const paintingId = Cell.derived(() =>
        route.get().params.get('paintingId')
      );
      const isReady = Cell.source(false);
      onSetup(() => {
        isReady.set(true);
        return () => isReady.set(false);
      });
      return (
        <div>
          <UniqueTransition transitionDuration="1ms">
            {If(paintingId, (id: string) =>
              If(isReady, () => <div>{`Stage ${id}`}</div>)
            )}
          </UniqueTransition>
        </div>
      );
    });

    const Title = createUnique<{ label: string }>((props) => {
      const label = Cell.derived(() => props.get().label);
      return <div>{label}</div>;
    });

    const CollectionPanel = () => {
      return (
        <div>
          {Title({ id: 'painting-title-1', label: 'Title 1' })}
          {Title({ id: 'painting-title-2', label: 'Title 2' })}
        </div>
      );
    };

    const PaintingDetails = () => {
      const route = useCurrentRoute();
      const paintingId = Cell.derived(() =>
        route.get().params.get('paintingId')
      );
      return If(paintingId, (id: string) => (
        <div>
          Child:[
          <Stage />]
          <Title id={`painting-title-${id}`} label={`Title ${id}`} />
        </div>
      ));
    };

    const routes = defineRoutes([
      {
        name: 'root',
        path: '/',
        component: () => {
          const { Outlet } = useRouter();
          return <Outlet />;
        },
        children: [
          {
            name: 'gallery',
            path: 'gallery',
            component: () => {
              const { Outlet } = useRouter();
              return (
                <div>
                  Parent:[
                  <Stage />]
                  <CollectionPanel />
                  <Outlet />
                </div>
              );
            },
            children: [
              {
                name: 'painting',
                path: ':paintingId',
                component: PaintingDetails,
              },
            ],
          },
        ],
      },
    ]);

    window.history.replaceState(null, '', '/gallery/1');

    const router = new Router({ routes, stackMode: true });
    const detach = router.attachWindowListeners(window);
    window.document.body.append(createRouterRoot(router));
    await runPendingSetupEffects();

    window.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await runPendingSetupEffects();

    expect(getTextContent(window.document.body)).toBe(
      'Parent:[]Title 2Child:[Stage 1]Title 1'
    );
    detach();
  });
});
