import type { JSX } from 'retend/jsx-runtime';

import {
  Await,
  Cell,
  For,
  If,
  type SourceCell,
  setActiveRenderer,
  waitForAsyncBoundaries,
} from 'retend';
import { hydrate, renderToString } from 'retend-server/client';
import { VDOMRenderer, VWindow } from 'retend-server/v-dom';
import { createUniqueTransition } from 'retend-utils/components';
import { setGlobalContext } from 'retend/context';
import { Router, createRouterRoot } from 'retend/router';
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

const Box = createUniqueTransition(
  () => {
    const count = Cell.source(0);
    return <div style={contentStyles}>{count}</div>;
  },
  {
    container: { style: uniqueStyles },
    transitionDuration: '250ms',
    transitionTimingFunction: 'ease-in-out',
  }
);

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
      teleportIdCounter: { value: 0 },
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
});
