import { onConnected, Cell, For, If, setActiveRenderer } from 'retend';
import { Router, createRouterRoot } from 'retend/router';
import { setGlobalContext } from 'retend/context';
import { hydrate, renderToString } from 'retend-server/client';
import { VDOMRenderer, VWindow } from 'retend-server/v-dom';
import { createUniqueTransition } from 'retend-utils/components';
import { describe, expect, it, vi } from 'vitest';
import { browserSetup, timeout } from '../setup.tsx';

const items = [
  { id: 1, name: 'Item 1', description: 'Description of Item 1' },
  { id: 2, name: 'Item 2', description: 'Description of Item 2' },
  { id: 3, name: 'Item 3', description: 'Description of Item 3' },
];

const Item = createUniqueTransition<{ item: (typeof items)[number] }>(
  (props) => {
    const item = Cell.derived(() => props.get().item);
    const name = Cell.derived(() => item.get().name);
    const description = Cell.derived(() => item.get().description);

    return (
      <>
        <h2>{name}</h2>
        <p>{description}</p>
      </>
    );
  },
  {
    container: { style: { height: '130px', minWidth: '200px' } },
    transitionDuration: '1200ms',
  }
);

function WithParentTransitions() {
  const selectedItemId = Cell.source<number | null>(1);

  return (
    <div>
      <h1>List of items.</h1>

      <ul>
        {For(items, (item) => (
          <li style={{ listStyleType: 'none' }}>
            <Item id={`item-heading-${item.id}`} item={item} />
            <button type="button" onClick={() => selectedItemId.set(item.id)}>
              Open
            </button>
          </li>
        ))}
      </ul>

      {If(selectedItemId, (itemId) => {
        const item = items.find((candidate) => candidate.id === itemId);
        const ref = Cell.source<HTMLDialogElement | null>(null);
        if (!item) return null;

        onConnected(ref, (dialog) => {
          dialog.showModal();
        });

        const handleClick = () => {
          const dialog = ref.get();
          if (!dialog) return;
          dialog.close();
        };

        return (
          <dialog
            ref={ref}
            style={{ overflow: 'visible' }}
            onClose={() => selectedItemId.set(null)}
          >
            <Item id={`item-heading-${item.id}`} item={item} />
            <button type="button" onClick={handleClick}>
              Close
            </button>
          </dialog>
        );
      })}
    </div>
  );
}

function createRouter() {
  return new Router({
    routes: [{ path: '/parent', component: WithParentTransitions }],
  });
}

describe('Hydration parent dialog close', () => {
  browserSetup();

  it('closes hydrated dialog without crashing updates', async () => {
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
    await serverRouter.navigate('/parent');
    const serverRoot = createRouterRoot(serverRouter);
    serverWindow.document.body.append(serverRoot);
    const html = renderToString(serverWindow.document.body, serverWindow);

    window.document.body.setHTMLUnsafe(
      `<div id="app">${html}</div><script data-server-context type="application/json">{"path":"/parent"}</script>`
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await hydrate(createRouter);

    const closeButton = window.document.querySelector(
      'dialog button'
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();

    closeButton?.click();
    await timeout(10);

    const hadAfterError = consoleErrorSpy.mock.calls.some((call) =>
      String(call[0]).includes('after is not a function')
    );
    consoleErrorSpy.mockRestore();

    expect(hadAfterError).toBe(false);
  });
});
