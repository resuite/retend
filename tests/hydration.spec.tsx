import { Cell, For, If, getActiveRenderer, setActiveRenderer } from 'retend';
import { DOMRenderer } from 'retend-web';
import { renderToString } from 'retend-server/client';
import { VDOMRenderer, VWindow } from 'retend-server/v-dom';
import { describe, expect, it } from 'vitest';
import { browserSetup, timeout } from './setup.tsx';
import type { JSX } from 'retend/jsx-runtime';

const setupHydration = async (templateFn: () => JSX.Template) => {
  const currentRenderer = getActiveRenderer() as DOMRenderer;
  const {
    host: clientWindow,
    host: { document },
  } = currentRenderer;

  const serverWindow = new VWindow();
  const serverRenderer = new VDOMRenderer(serverWindow, {
    markDynamicNodes: true,
  });
  setActiveRenderer(serverRenderer);

  const vdomTree = templateFn();
  const html = await renderToString(vdomTree, serverWindow);

  // 2. Client Setup Phase
  document.body.innerHTML = `<div id="app">${html}</div>`;
  const root = document.querySelector('#app') as HTMLElement;

  // 3. Client Hydration Initiation
  const clientRenderer = new DOMRenderer(clientWindow);
  setActiveRenderer(clientRenderer);
  clientRenderer.enableHydrationMode();

  await clientRenderer.hydrateChildrenWhenResolved(Promise.resolve());
  templateFn();
  clientRenderer.endHydration();

  return {
    html,
    window: clientWindow,
    document,
    root,
    renderer: clientRenderer,
  };
};

describe('Hydration', () => {
  browserSetup();

  it('should hydrate a static string and add interactivity', async () => {
    const count = Cell.source(0);
    const template = () => (
      <div>
        <button
          id="btn"
          type="button"
          onClick={() => count.set(count.get() + 1)}
        >
          Count: {count}
        </button>
      </div>
    );

    const { document } = await setupHydration(template);
    const btn = document.querySelector('#btn') as HTMLButtonElement;

    expect(btn.textContent).toBe('Count: 0');

    btn.click();
    await timeout();
    expect(btn.textContent).toBe('Count: 1');
  });

  it('should preserve existing DOM nodes during hydration', async () => {
    const text = Cell.source('Initial');
    const template = () => (
      <div>
        <span id="static">Static</span>
        <span id="dynamic">{text}</span>
      </div>
    );

    const { document } = await setupHydration(template);
    const staticSpan = document.querySelector('#static');
    const dynamicSpan = document.querySelector('#dynamic');

    expect(staticSpan).not.toBeNull();
    expect(dynamicSpan).not.toBeNull();

    // Check nodes are same
    expect(document.querySelector('#static')).toBe(staticSpan);
    expect(document.querySelector('#dynamic')).toBe(dynamicSpan);

    text.set('Updated');
    await timeout();
    expect(dynamicSpan?.textContent).toBe('Updated');
  });

  it('should hydrate dynamic attributes', async () => {
    const cls = Cell.source('initial-class');
    const template = () => (
      <div id="target" class={cls}>
        Content
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#target') as HTMLElement;

    expect(div.className).toBe('initial-class');

    cls.set('updated-class');
    await timeout();
    expect(div.className).toBe('updated-class');
  });

  it('should hydrate If blocks', async () => {
    const show = Cell.source(true);
    const template = () => (
      <div id="container">
        {If(show, {
          true: () => <span id="true-branch">Visible</span>,
          false: () => <span id="false-branch">Hidden</span>,
        })}
      </div>
    );

    const { document } = await setupHydration(template);
    expect(document.querySelector('#true-branch')).not.toBeNull();

    show.set(false);
    await timeout();
    expect(document.querySelector('#true-branch')).toBeNull();
    expect(document.querySelector('#false-branch')).not.toBeNull();
  });

  it('should hydrate For blocks', async () => {
    const items = Cell.source(['Item 1', 'Item 2']);
    const template = () => (
      <ul id="list">
        {For(items, (item) => (
          <li class="item">{item}</li>
        ))}
      </ul>
    );

    const { document } = await setupHydration(template);
    expect(document.querySelectorAll('.item').length).toBe(2);

    items.set([...items.get(), 'Item 3']);
    await timeout();
    expect(document.querySelectorAll('.item').length).toBe(3);
  });

  it('should hydrate async components', async () => {
    const AsyncComp = async () => {
      await timeout(10);
      return <div id="async-content">Resolved</div>;
    };
    const template = () => (
      <div>
        <AsyncComp />
      </div>
    );

    const { document } = await setupHydration(template);
    expect(document.querySelector('#async-content')).not.toBeNull();
    expect(document.querySelector('#async-content')?.textContent).toBe(
      'Resolved'
    );
  });
});
