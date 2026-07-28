import type { JSX } from 'retend/jsx-runtime';

import {
  Await,
  Cell,
  For,
  If,
  createUnique,
  getActiveRenderer,
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

  it('uses client rendering without hydration errors for an empty root', async () => {
    window.document.body.setHTMLUnsafe('<div id="app"></div>');
    window.history.replaceState(null, '', '/');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await hydrate(createRouter);

    const errors = consoleErrorSpy.mock.calls.map((call) =>
      call.map(String).join(' ')
    );
    consoleErrorSpy.mockRestore();
    expect(window.document.querySelector('#app')?.children.length).toBe(1);
    expect(
      errors.filter((message) => message.includes('Hydration error:'))
    ).toEqual([]);
  });

  it('uses client rendering for a whitespace-only root', async () => {
    window.document.body.setHTMLUnsafe('<div id="app">\n  </div>');
    window.history.replaceState(null, '', '/');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await hydrate(createRouter);

    const errors = consoleErrorSpy.mock.calls.map((call) =>
      call.map(String).join(' ')
    );
    consoleErrorSpy.mockRestore();
    expect(window.document.querySelector('#app')?.children.length).toBe(1);
    expect(
      errors.filter((message) => message.includes('Hydration error:'))
    ).toEqual([]);
  });

  it('hydrates in a fresh context after an earlier client render', async () => {
    getActiveRenderer().render(() => <div>Earlier application</div>);
    window.document.body.setHTMLUnsafe('<div id="app"></div>');
    window.history.replaceState(null, '', '/');

    await hydrate(createRouter);

    expect(window.document.querySelector('#app')?.children.length).toBe(1);
  });

  it('detaches router listeners when hydration rejects', async () => {
    const createMismatchRouter = () =>
      new Router({
        routes: [{ path: '/', component: () => <main>Client</main> }],
      });
    window.document.body.setHTMLUnsafe(
      '<div id="app" data-retend-hydration="1"><aside>Server</aside></div>'
    );
    window.history.replaceState(null, '', '/');
    const removeListener = vi.spyOn(window, 'removeEventListener');

    await expect(hydrate(createMismatchRouter)).rejects.toThrow();
    expect(
      removeListener.mock.calls.some(([type]) => type === 'popstate')
    ).toBe(true);
  });

  it('preserves the initial location hash', async () => {
    const createHashRouter = () =>
      new Router({
        routes: [{ path: '/article', component: () => <div>Article</div> }],
      });
    window.document.body.setHTMLUnsafe('<div id="app"></div>');
    window.history.replaceState(null, '', '/article#section1');

    const router = await hydrate(createHashRouter);

    expect(router.getCurrentRoute().get().fullPath).toBe('/article#section1');
    expect(router.getCurrentRoute().get().hash).toBe('section1');
    expect(window.location.hash).toBe('#section1');
  });

  it('hydrates without mismatch errors', async () => {
    setGlobalContext({
      globalData: new Map(),
    });

    const serverWindow = new VWindow();
    const serverRenderer = new VDOMRenderer(serverWindow);
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
      `<div id="app" data-retend-hydration="1">${html}</div>`
    );
    window.history.replaceState(null, '', '/');

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await hydrate(createRouter);

    expect(
      window.document
        .querySelector('#app')
        ?.hasAttribute('data-retend-hydration')
    ).toBe(false);
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
    const serverRenderer = new VDOMRenderer(serverWindow);
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
      `<div id="app" data-retend-hydration="1">${html}</div>`
    );
    window.history.replaceState(null, '', '/gallery/1');

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await hydrate(createStackRouter);

    const errors = consoleErrorSpy.mock.calls.map((call) =>
      call.map(String).join(' ')
    );
    consoleErrorSpy.mockRestore();

    expect(
      errors.filter((message) => message.includes('Hydration error:'))
    ).toEqual([]);
    expect(
      errors.some((message) => message.includes('after is not a function'))
    ).toBe(false);
  });
});
