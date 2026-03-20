import type { JSX } from 'retend/jsx-runtime';

import {
  Await,
  Cell,
  For,
  If,
  createUnique,
  onSetup,
  type SourceCell,
  setActiveRenderer,
  waitForAsyncBoundaries,
} from 'retend';
import { ClientOnly } from 'retend-server';
import { hydrate, renderToString } from 'retend-server/client';
import { VDOMRenderer, VWindow } from 'retend-server/v-dom';
import { UniqueTransition } from 'retend-utils/components';
import { setGlobalContext } from 'retend/context';
import {
  Outlet,
  Router,
  createRouterRoot,
  defineRoutes,
  useCurrentRoute,
} from 'retend/router';
import { describe, expect, it, vi } from 'vitest';

import { browserSetup } from '../setup.tsx';

const appStyles: JSX.StyleValue = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '20px',
  height: '100dvh',
  paddingInline: '20px',
  justifyContent: 'center',
  alignItems: 'center',
  placeContent: 'center',
};

const contentStyles: JSX.StyleValue = {
  display: 'grid',
  placeItems: 'center',
  height: '100%',
  aspectRatio: '1',
  fontSize: '3rem',
  backgroundColor: '#467497',
  color: 'white',
  borderRadius: '13px',
};

const uniqueStyles: JSX.StyleValue = {
  display: 'block',
  width: '100%',
  height: '100%',
};

const buttonStyles: JSX.StyleValue = {
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  minHeight: '9rem',
  aspectRatio: '1',
  border: '2px dashed',
  cursor: 'pointer',
  borderRadius: '15px',
  padding: '0',
};

const Box = createUnique(() => {
  const count = Cell.source(0);
  return (
    <UniqueTransition
      transitionDuration="250ms"
      transitionTimingFunction="ease-in-out"
    >
      <div style={{ ...uniqueStyles, ...contentStyles }}>{count}</div>
    </UniqueTransition>
  );
});

const Container = (props: {
  index: Cell<number>;
  selected: SourceCell<number>;
}) => {
  const { index, selected } = props;
  const isSelected = Cell.derived(() => index.get() === selected.get());

  return (
    <button type="button" style={buttonStyles}>
      {If(isSelected, () => (
        <Box />
      ))}
    </button>
  );
};

const App = () => {
  const containers = Array.from({ length: 8 }).fill(null);
  const selected = Cell.source(0);

  return (
    <div style={appStyles}>
      {For(containers, (_, index) => (
        <Container selected={selected} index={index} />
      ))}
    </div>
  );
};

function createRouter() {
  return new Router({
    routes: [{ path: '/', component: App }],
  });
}

describe('Hydration router + unique transition', () => {
  browserSetup();

  it('hydrates without mismatch errors', async () => {
    setGlobalContext({
      globalData: new Map(),
    });

    const serverWindow = new VWindow();
    const serverRenderer = new VDOMRenderer(serverWindow, {
      markDynamicNodes: true,
    });
    setActiveRenderer(serverRenderer);

    const serverRouter = createRouter();
    await serverRouter.navigate('/');
    const serverRoot = serverRenderer.render(() =>
      Await({
        fallback: null,
        children: () => createRouterRoot(serverRouter),
      })
    );
    const serverNodes = Array.isArray(serverRoot) ? serverRoot : [serverRoot];
    serverWindow.document.body.append(...serverNodes);
    await waitForAsyncBoundaries();
    const html = renderToString(serverWindow.document.body, serverWindow);

    window.document.body.setHTMLUnsafe(
      `<div id="app">${html}</div><script data-server-context type="application/json">{"path":"/"}</script>`
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await hydrate(createRouter);

    const hadHydrationError = consoleErrorSpy.mock.calls.some((call) =>
      String(call[0]).includes('Hydration error:')
    );
    consoleErrorSpy.mockRestore();

    expect(hadHydrationError).toBe(false);
  });

  it('hydrates stack-mode direct entry with unique client-only content', async () => {
    const Stage = createUnique(() => {
      const route = useCurrentRoute();
      const paintingId = Cell.derived(() =>
        route.get().params.get('paintingId')
      );
      const ready = Cell.source(false);

      onSetup(() => {
        ready.set(true);
        return () => ready.set(false);
      });

      return (
        <ClientOnly>
          <UniqueTransition transitionDuration="1ms">
            {If(paintingId, (id: string) =>
              If(ready, () => <div>{`Stage ${id}`}</div>)
            )}
          </UniqueTransition>
        </ClientOnly>
      );
    });

    const routes = defineRoutes([
      {
        path: '/',
        component: () => <Outlet />,
        children: [
          {
            path: 'gallery',
            component: () => (
              <div>
                <Stage />
                <div class="_uiLayer_w76og_3">flex</div>
                <Outlet />
              </div>
            ),
            children: [
              {
                path: ':paintingId',
                component: () => (
                  <div>
                    <Stage />
                  </div>
                ),
              },
            ],
          },
        ],
      },
    ]);

    const createStackRouter = () =>
      new Router({
        routes,
        stackMode: true,
      });

    setGlobalContext({
      globalData: new Map(),
    });

    const serverWindow = new VWindow();
    const serverRenderer = new VDOMRenderer(serverWindow, {
      markDynamicNodes: true,
    });
    setActiveRenderer(serverRenderer);

    const serverRouter = createStackRouter();
    await serverRouter.navigate('/gallery/1');
    const serverRoot = serverRenderer.render(() =>
      Await({
        fallback: null,
        children: () => createRouterRoot(serverRouter),
      })
    );
    const serverNodes = Array.isArray(serverRoot) ? serverRoot : [serverRoot];
    serverWindow.document.body.append(...serverNodes);
    await waitForAsyncBoundaries();
    const html = renderToString(serverWindow.document.body, serverWindow);

    window.document.body.setHTMLUnsafe(
      `<div id="app">${html}</div><script data-server-context type="application/json">{"path":"/gallery/1"}</script>`
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await hydrate(createStackRouter);

    const errors = consoleErrorSpy.mock.calls.map((call) =>
      call.map(String).join(' ')
    );
    consoleErrorSpy.mockRestore();

    expect(errors.some((message) => message.includes('Hydration error:'))).toBe(
      false
    );
    expect(
      errors.some((message) => message.includes('after is not a function'))
    ).toBe(false);
  });
});
