import { Cell, For, If, Switch, Unique, getActiveRenderer, setActiveRenderer } from 'retend';
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

  it('should hydrate dynamic classes', async () => {
    const cls = Cell.source(['a', 'b']);
    const template = () => <div id="target" class={cls}>Content</div>;

    const { document } = await setupHydration(template);
    const div = document.querySelector('#target') as HTMLElement;

    expect(div.classList.contains('a')).toBe(true);
    expect(div.classList.contains('b')).toBe(true);

    cls.set(['a', 'c']);
    await timeout();
    expect(div.classList.contains('b')).toBe(false);
    expect(div.classList.contains('c')).toBe(true);
  });

  it('should hydrate Switch blocks', async () => {
    const state = Cell.source('a');
    const template = () => (
      <div id="container">
        {Switch(state, {
          a: () => <span id="a">A</span>,
          b: () => <span id="b">B</span>,
          default: () => <span id="default">Default</span>,
        })}
      </div>
    );

    const { document } = await setupHydration(template);
    expect(document.querySelector('#a')).not.toBeNull();

    state.set('b');
    await timeout();
    expect(document.querySelector('#a')).toBeNull();
    expect(document.querySelector('#b')).not.toBeNull();
  });

  it('should hydrate complex nested control flow (For in If in Switch)', async () => {
    const mode = Cell.source('list');
    const show = Cell.source(true);
    const items = Cell.source(['Item 1']);

    const template = () => (
      <div id="complex-root">
        {Switch(mode, {
          list: () => If(show, {
            true: () => (
              <ul id="main-list">
                {For(items, (item) => <li class="list-item">{item}</li>)}
              </ul>
            ),
            false: () => <div id="hidden">Hidden</div>
          }),
          other: () => <div id="other">Other</div>
        })}
      </div>
    );

    const { document } = await setupHydration(template);
    expect(document.querySelectorAll('.list-item').length).toBe(1);

    items.set(['Item 1', 'Item 2']);
    await timeout();
    expect(document.querySelectorAll('.list-item').length).toBe(2);

    show.set(false);
    await timeout();
    expect(document.querySelector('#main-list')).toBeNull();
    expect(document.querySelector('#hidden')).not.toBeNull();

    mode.set('other');
    await timeout();
    expect(document.querySelector('#hidden')).toBeNull();
    expect(document.querySelector('#other')).not.toBeNull();
  });

  it('should hydrate Unique components', async () => {
    const count = Cell.source(0);
    const template = () => (
      <div>
        <Unique id="unique-comp">
          <button id="unique-btn" onClick={() => count.set(count.get() + 1)}>
            Unique: {count}
          </button>
        </Unique>
      </div>
    );

    const { document } = await setupHydration(template);
    const btn = document.querySelector('#unique-btn') as HTMLButtonElement;
    expect(btn.textContent).toBe('Unique: 0');

    btn.click();
    await timeout();
    expect(btn.textContent).toBe('Unique: 1');
  });

  it('should hydrate nested components with independent state', async () => {
    const parentCount = Cell.source(0);
    const childCount = Cell.source(0);

    const Child = (props: { count: Cell<number> }) => (
      <div id="child">
        <button id="child-btn" type="button" onClick={() => props.count.set(props.count.get() + 1)}>
          Child: {props.count}
        </button>
      </div>
    );

    const template = () => (
      <div id="parent">
        <button id="parent-btn" type="button" onClick={() => parentCount.set(parentCount.get() + 1)}>
          Parent: {parentCount}
        </button>
        <Child count={childCount} />
      </div>
    );

    const { document } = await setupHydration(template);
    const pBtn = document.querySelector('#parent-btn') as HTMLButtonElement;
    const cBtn = document.querySelector('#child-btn') as HTMLButtonElement;

    expect(pBtn.textContent).toBe('Parent: 0');
    expect(cBtn.textContent).toBe('Child: 0');

    pBtn.click();
    await timeout();
    expect(pBtn.textContent).toBe('Parent: 1');
    expect(cBtn.textContent).toBe('Child: 0');

    cBtn.click();
    await timeout();
    expect(pBtn.textContent).toBe('Parent: 1');
    expect(cBtn.textContent).toBe('Child: 1');
  });

  it('should hydrate deeply nested control flow (For inside If)', async () => {
    const show = Cell.source(true);
    const items = Cell.source(['A', 'B']);
    const template = () => (
      <div id="nested-root">
        {If(show, {
          true: () => (
            <ul id="nested-list">
              {For(items, (item) => <li class="nested-item">{item}</li>)}
            </ul>
          ),
          false: () => <div id="nested-empty">Empty</div>
        })}
      </div>
    );

    const { document } = await setupHydration(template);
    expect(document.querySelectorAll('.nested-item').length).toBe(2);

    items.set(['A', 'B', 'C']);
    await timeout();
    expect(document.querySelectorAll('.nested-item').length).toBe(3);

    show.set(false);
    await timeout();
    expect(document.querySelector('#nested-list')).toBeNull();
    expect(document.querySelector('#nested-empty')).not.toBeNull();
  });

  it('should hydrate multiple dynamic attributes on a single node', async () => {
    const color = Cell.source('red');
    const title = Cell.source('initial-title');
    const template = () => (
      <div id="multi-attr" style={{ color }} title={title}>
        Content
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#multi-attr') as HTMLElement;

    expect(div.style.color).toBe('red');
    expect(div.title).toBe('initial-title');

    color.set('blue');
    title.set('updated-title');
    await timeout();

    expect(div.style.color).toBe('blue');
    expect(div.title).toBe('updated-title');
  });

  it('should hydrate mixed static and dynamic children', async () => {
    const dynamicText = Cell.source('Dynamic');
    const template = () => (
      <div id="mixed">
        <span>Static 1</span>
        {dynamicText}
        <span>Static 2</span>
      </div>
    );

    const { document } = await setupHydration(template);
    const root = document.querySelector('#mixed') as HTMLElement;
    
    expect(root.childNodes.length).toBe(3);
    expect(root.textContent).toBe('Static 1DynamicStatic 2');

    dynamicText.set('Modified');
    await timeout();
    expect(root.textContent).toBe('Static 1ModifiedStatic 2');
  });

  it('should hydrate templates returning fragments', async () => {
    const text1 = Cell.source('A');
    const text2 = Cell.source('B');
    const template = () => (
      <>
        <span id="f1">{text1}</span>
        <span id="f2">{text2}</span>
      </>
    );

    const { document } = await setupHydration(template);
    const f1 = document.querySelector('#f1');
    const f2 = document.querySelector('#f2');

    expect(f1?.textContent).toBe('A');
    expect(f2?.textContent).toBe('B');

    text1.set('A+');
    text2.set('B+');
    await timeout();

    expect(f1?.textContent).toBe('A+');
    expect(f2?.textContent).toBe('B+');
  });

  it('should hydrate style object with reactive property alone', async () => {
    const color = Cell.source('red');
    const template = () => <div id="style-test" style={{ color }}>Styled</div>;

    const { document } = await setupHydration(template);
    const div = document.querySelector('#style-test') as HTMLElement;

    expect(div.style.color).toBe('red');

    color.set('blue');
    await timeout();
    expect(div.style.color).toBe('blue');
  });
});
