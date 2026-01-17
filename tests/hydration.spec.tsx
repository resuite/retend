import {
  Cell,
  For,
  If,
  type SourceCell,
  Switch,
  createUnique,
  getActiveRenderer,
  setActiveRenderer,
} from 'retend';
import { DOMRenderer, ShadowRoot, Teleport } from 'retend-web';
import { renderToString } from 'retend-server/client';
import { VDOMRenderer, type VNode, VWindow } from 'retend-server/v-dom';
import { describe, expect, it, vi } from 'vitest';
import { browserSetup } from './setup.tsx';
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

  serverWindow.document.body.append(templateFn() as VNode);
  await serverWindow.document.mountAllTeleports();
  const html = await renderToString(serverWindow.document.body, serverWindow);

  // 2. Client Setup Phase
  document.body.setHTMLUnsafe(`<div id="app">${html}</div>`);
  const root = document.querySelector('#app') as HTMLElement;

  // 3. Client Hydration Initiation
  const clientRenderer = new DOMRenderer(clientWindow);
  setActiveRenderer(clientRenderer);
  clientRenderer.enableHydrationMode();

  await clientRenderer.hydrateChildrenWhenResolved(Promise.resolve());
  templateFn();
  await clientRenderer.endHydration();

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

    expect(document.querySelectorAll('.item').length).toBe(3);
  });

  it('should hydrate dynamic classes', async () => {
    const cls = Cell.source(['a', 'b']);
    const template = () => (
      <div id="target" class={cls}>
        Content
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#target') as HTMLElement;

    expect(div.classList.contains('a')).toBe(true);
    expect(div.classList.contains('b')).toBe(true);

    cls.set(['a', 'c']);

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
          list: () =>
            If(show, {
              true: () => (
                <ul id="main-list">
                  {For(items, (item) => (
                    <li class="list-item">{item}</li>
                  ))}
                </ul>
              ),
              false: () => <div id="hidden">Hidden</div>,
            }),
          other: () => <div id="other">Other</div>,
        })}
      </div>
    );

    const { document } = await setupHydration(template);
    expect(document.querySelectorAll('.list-item').length).toBe(1);

    items.set(['Item 1', 'Item 2']);

    expect(document.querySelectorAll('.list-item').length).toBe(2);

    show.set(false);

    expect(document.querySelector('#main-list')).toBeNull();
    expect(document.querySelector('#hidden')).not.toBeNull();

    mode.set('other');

    expect(document.querySelector('#hidden')).toBeNull();
    expect(document.querySelector('#other')).not.toBeNull();
  });

  it('should hydrate Unique components', async () => {
    const count = Cell.source(0);
    const Component = createUnique(() => (
      <button
        id="unique-btn"
        type="button"
        onClick={() => count.set(count.get() + 1)}
      >
        Unique: {count}
      </button>
    ));
    const template = () => (
      <div>
        <Component />
      </div>
    );

    const { document } = await setupHydration(template);
    const btn = document.querySelector('#unique-btn') as HTMLButtonElement;
    expect(btn.textContent).toBe('Unique: 0');

    btn.click();

    expect(btn.textContent).toBe('Unique: 1');
  });

  it('should hydrate nested components with independent state', async () => {
    const parentCount = Cell.source(0);
    const childCount = Cell.source(0);

    const Child = (props: { count: SourceCell<number> }) => (
      <div id="child">
        <button
          id="child-btn"
          type="button"
          onClick={() => props.count.set(props.count.get() + 1)}
        >
          Child: {props.count}
        </button>
      </div>
    );

    const template = () => (
      <div id="parent">
        <button
          id="parent-btn"
          type="button"
          onClick={() => parentCount.set(parentCount.get() + 1)}
        >
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

    expect(pBtn.textContent).toBe('Parent: 1');
    expect(cBtn.textContent).toBe('Child: 0');

    cBtn.click();

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
              {For(items, (item) => (
                <li class="nested-item">{item}</li>
              ))}
            </ul>
          ),
          false: () => <div id="nested-empty">Empty</div>,
        })}
      </div>
    );

    const { document } = await setupHydration(template);
    expect(document.querySelectorAll('.nested-item').length).toBe(2);

    items.set(['A', 'B', 'C']);

    expect(document.querySelectorAll('.nested-item').length).toBe(3);

    show.set(false);

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

    expect(f1?.textContent).toBe('A+');
    expect(f2?.textContent).toBe('B+');
  });

  it('should hydrate style object with reactive property alone', async () => {
    const color = Cell.source('red');
    const template = () => (
      <div id="style-test" style={{ color }}>
        Styled
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#style-test') as HTMLElement;

    expect(div.style.color).toBe('red');

    color.set('blue');

    expect(div.style.color).toBe('blue');
  });

  it('should hydrate Teleport to target by ID', async () => {
    const template = () => (
      <div>
        <div id="teleport-target" />
        <Teleport id="test" to="#teleport-target">
          <div id="teleported-content">Teleported content</div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#teleport-target');
    const teleported = target?.querySelector('#teleported-content');

    expect(target).not.toBeNull();
    expect(teleported).not.toBeNull();
    expect(teleported?.textContent).toBe('Teleported content');
  });

  it('should hydrate Teleport with dynamic content', async () => {
    const content = Cell.source('Initial content');
    const template = () => (
      <div>
        <div id="dynamic-target" />
        <Teleport to="#dynamic-target">
          <div id="dynamic-teleported">{content}</div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#dynamic-target');
    const teleported = target?.querySelector('#dynamic-teleported');

    expect(teleported?.textContent).toBe('Initial content');

    content.set('Updated content');

    expect(teleported?.textContent).toBe('Updated content');
  });

  it('should hydrate multiple Teleports to same target', async () => {
    const template = () => (
      <div>
        <div id="multi-target" />
        <Teleport to="#multi-target">
          <div id="first">First teleport</div>
        </Teleport>
        <Teleport to="#multi-target">
          <div id="second">Second teleport</div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#multi-target');
    const first = target?.querySelector('#first');
    const second = target?.querySelector('#second');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.textContent).toBe('First teleport');
    expect(second?.textContent).toBe('Second teleport');
  });

  it('should hydrate Teleport with dynamic attributes on children', async () => {
    const color = Cell.source('red');
    const template = () => (
      <div>
        <div id="attr-target" />
        <Teleport to="#attr-target">
          <div id="styled-teleported" style={{ color }}>
            Styled content
          </div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#attr-target');
    const teleported = target?.querySelector(
      '#styled-teleported'
    ) as HTMLElement;

    expect(teleported?.style.color).toBe('red');

    color.set('blue');

    expect(teleported?.style.color).toBe('blue');
  });

  it('should hydrate Teleport with control flow inside', async () => {
    const show = Cell.source(true);
    const items = Cell.source(['A', 'B']);
    const template = () => (
      <div>
        <div id="control-target" />
        <Teleport to="#control-target">
          {If(show, {
            true: () => (
              <div>
                <div id="if-content">Visible</div>
                <ul id="for-list">
                  {For(items, (item) => (
                    <li class="control-item">{item}</li>
                  ))}
                </ul>
              </div>
            ),
            false: () => <div id="hidden">Hidden</div>,
          })}
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#control-target');
    const ifContent = target?.querySelector('#if-content');
    const forItems = target?.querySelectorAll('.control-item');

    expect(ifContent).not.toBeNull();
    expect(forItems?.length).toBe(2);

    show.set(false);

    expect(target?.querySelector('#if-content')).toBeNull();
    expect(target?.querySelector('#hidden')).not.toBeNull();
  });

  it('should hydrate nested Teleports', async () => {
    const template = () => (
      <div>
        <div id="outer-target" />
        <Teleport to="#outer-target">
          <div id="outer-content">
            <div id="inner-target" />
            <Teleport to="#inner-target">
              <div id="inner-content">Inner teleported</div>
            </Teleport>
          </div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const outerTarget = document.querySelector('#outer-target');
    const outerContent = outerTarget?.querySelector('#outer-content');
    const innerTarget = outerContent?.querySelector('#inner-target');
    const innerContent = innerTarget?.querySelector('#inner-content');

    expect(outerContent).not.toBeNull();
    expect(innerContent).not.toBeNull();
    expect(innerContent?.textContent).toBe('Inner teleported');
  });

  it('should hydrate Teleport with Switch inside', async () => {
    const mode = Cell.source('a');
    const template = () => (
      <div>
        <div id="switch-target" />
        <Teleport to="#switch-target">
          {Switch(mode, {
            a: () => <div id="mode-a">Mode A</div>,
            b: () => <div id="mode-b">Mode B</div>,
            default: () => <div id="mode-default">Default</div>,
          })}
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#switch-target');

    expect(target?.querySelector('#mode-a')).not.toBeNull();

    mode.set('b');

    expect(target?.querySelector('#mode-a')).toBeNull();
    expect(target?.querySelector('#mode-b')).not.toBeNull();
  });

  it('should hydrate Teleport with Unique component inside', async () => {
    const count = Cell.source(0);
    const Component = createUnique(() => (
      <button
        id="teleport-btn"
        type="button"
        onClick={() => count.set(count.get() + 1)}
      >
        Count: {count}
      </button>
    ));
    const template = () => (
      <div>
        <div id="unique-target" />
        <Teleport to="#unique-target">
          <Component />
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const btn = document.querySelector('#teleport-btn') as HTMLButtonElement;

    expect(btn.textContent).toBe('Count: 0');

    btn.click();

    expect(btn.textContent).toBe('Count: 1');
  });

  it('should hydrate Teleport with events on children', async () => {
    let clicked = false;
    const handleClick = () => {
      clicked = true;
    };
    const template = () => (
      <div>
        <div id="event-target" />
        <Teleport to="#event-target">
          <button id="teleport-event-btn" type="button" onClick={handleClick}>
            Click me
          </button>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const btn = document.querySelector(
      '#teleport-event-btn'
    ) as HTMLButtonElement;

    expect(clicked).toBe(false);

    btn.click();

    expect(clicked).toBe(true);
  });

  it('should hydrate Teleport with multiple dynamic children', async () => {
    const text1 = Cell.source('First');
    const text2 = Cell.source('Second');
    const text3 = Cell.source('Third');
    const template = () => (
      <div>
        <div id="multi-child-target" />
        <Teleport to="#multi-child-target">
          <div id="child1">{text1}</div>
          <div id="child2">{text2}</div>
          <div id="child3">{text3}</div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#multi-child-target');
    const child1 = target?.querySelector('#child1');
    const child2 = target?.querySelector('#child2');
    const child3 = target?.querySelector('#child3');

    expect(child1?.textContent).toBe('First');
    expect(child2?.textContent).toBe('Second');
    expect(child3?.textContent).toBe('Third');

    text1.set('First Updated');
    text2.set('Second Updated');
    text3.set('Third Updated');

    expect(child1?.textContent).toBe('First Updated');
    expect(child2?.textContent).toBe('Second Updated');
    expect(child3?.textContent).toBe('Third Updated');
  });

  it('should hydrate Teleport with fragment content', async () => {
    const text = Cell.source('Fragment content');
    const template = () => (
      <div>
        <div id="fragment-target" />
        <Teleport to="#fragment-target">
          <>
            <span id="frag1">{text}</span>
            <span id="frag2">Static fragment</span>
          </>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#fragment-target');
    const frag1 = target?.querySelector('#frag1');
    const frag2 = target?.querySelector('#frag2');

    expect(frag1?.textContent).toBe('Fragment content');
    expect(frag2?.textContent).toBe('Static fragment');

    text.set('Updated fragment');

    expect(frag1?.textContent).toBe('Updated fragment');
  });

  it('should hydrate Teleport with form elements', async () => {
    const placeholder = Cell.source('Enter text');
    const value = Cell.source('Initial');
    const template = () => (
      <div>
        <div id="form-target" />
        <Teleport to="#form-target">
          <div>
            <input
              id="teleport-input"
              type="text"
              placeholder={placeholder}
              value={value}
            />
            <label for="teleport-input">Teleported input</label>
          </div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#form-target');
    const input = target?.querySelector('#teleport-input') as HTMLInputElement;

    expect(input?.placeholder).toBe('Enter text');
    expect(input?.value).toBe('Initial');

    placeholder.set('Updated placeholder');
    value.set('Updated value');

    expect(input?.placeholder).toBe('Updated placeholder');
    expect(input?.value).toBe('Updated value');
  });

  it('should hydrate Teleport with text-only content', async () => {
    const text = Cell.source('Plain text content');
    const template = () => (
      <div>
        <div id="text-target" />
        <Teleport to="#text-target">{text}</Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#text-target');

    expect(target?.textContent).toBe('Plain text content');

    text.set('Updated plain text');

    expect(target?.textContent).toBe('Updated plain text');
  });

  it('should hydrate Teleport with multiple nested For loops', async () => {
    const categories = Cell.source([
      { name: 'Fruits', items: ['Apple', 'Banana'] },
      { name: 'Vegetables', items: ['Carrot', 'Potato'] },
    ]);
    const template = () => (
      <div>
        <div id="nested-for-target" />
        <Teleport to="#nested-for-target">
          <div>
            {For(categories, (category) => (
              <div class="category" id={`cat-${category.name}`}>
                <h3>{category.name}</h3>
                <ul>
                  {For(category.items, (item) => (
                    <li class="item">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#nested-for-target');
    const categoriesEl = target?.querySelectorAll('.category');
    const items = target?.querySelectorAll('.item');

    expect(categoriesEl?.length).toBe(2);
    expect(items?.length).toBe(4);
    expect(target?.querySelector('#cat-Fruits')).not.toBeNull();
    expect(target?.querySelector('#cat-Vegetables')).not.toBeNull();
  });

  it('should hydrate Teleport with dynamic class list', async () => {
    const classes = Cell.source(['class1', 'class2']);
    const template = () => (
      <div>
        <div id="class-target" />
        <Teleport to="#class-target">
          <div id="dynamic-class" class={classes}>
            Dynamic classes
          </div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#class-target');
    const div = target?.querySelector('#dynamic-class') as HTMLElement;

    expect(div?.classList.contains('class1')).toBe(true);
    expect(div?.classList.contains('class2')).toBe(true);

    classes.set(['class1', 'class3']);

    expect(div?.classList.contains('class2')).toBe(false);
    expect(div?.classList.contains('class3')).toBe(true);
  });

  it('should hydrate Teleport with mixed static and dynamic content', async () => {
    const dynamic = Cell.source('Dynamic');
    const template = () => (
      <div>
        <div id="mixed-target" />
        <Teleport to="#mixed-target">
          <div id="mixed-content">
            <span>Static start</span>
            {dynamic}
            <span>Static end</span>
          </div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#mixed-target');
    const content = target?.querySelector('#mixed-content');

    expect(content?.textContent).toBe('Static startDynamicStatic end');

    dynamic.set('Updated');

    expect(content?.textContent).toBe('Static startUpdatedStatic end');
  });

  it('should hydrate Teleport with SVG elements', async () => {
    const fill = Cell.source('red');
    const template = () => (
      <div>
        <div id="svg-target" />
        <Teleport to="#svg-target">
          <svg id="teleport-svg" width="100" height="100">
            <title>Test SVG</title>
            <circle cx="50" cy="50" r="40" fill={fill} />
          </svg>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#svg-target');
    const svg = target?.querySelector('#teleport-svg');
    const circle = svg?.querySelector('circle');

    expect(svg).not.toBeNull();
    expect(circle?.getAttribute('fill')).toBe('red');

    fill.set('blue');

    expect(circle?.getAttribute('fill')).toBe('blue');
  });

  it('should hydrate Teleport with For containing Unique components', async () => {
    const items = Cell.source(['A', 'B', 'C']);
    const Item = createUnique<{ item: string }>((props) => {
      const { item } = props.get();
      return (
        <div class="unique-item" id={`item-el-${item}`}>
          Item: {item}
        </div>
      );
    });
    const template = () => (
      <div>
        <div id="unique-for-target" />
        <Teleport to="#unique-for-target">
          <div>
            {For(items, (item, index) => (
              <Item id={`item-el-${index.get()}`} item={item} />
            ))}
          </div>
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#unique-for-target');
    const itemsEl = target?.querySelectorAll('.unique-item');

    expect(itemsEl?.length).toBe(3);
    expect(target?.querySelector('#item-el-A')).not.toBeNull();
    expect(target?.querySelector('#item-el-B')).not.toBeNull();
    expect(target?.querySelector('#item-el-C')).not.toBeNull();
  });

  it('should hydrate Teleport with If containing For containing If', async () => {
    const showList = Cell.source(true);
    const showItems = Cell.source(true);
    const items = Cell.source(['X', 'Y']);
    const template = () => (
      <div>
        <div id="deep-nest-target" />
        <Teleport to="#deep-nest-target">
          {If(showList, {
            true: () => (
              <div id="outer-if">
                {If(showItems, {
                  true: () => (
                    <ul id="inner-if-list">
                      {For(items, (item) => (
                        <li class="deep-item">{item}</li>
                      ))}
                    </ul>
                  ),
                  false: () => <div id="items-hidden">Items hidden</div>,
                })}
              </div>
            ),
            false: () => <div id="list-hidden">List hidden</div>,
          })}
        </Teleport>
      </div>
    );

    const { document } = await setupHydration(template);
    const target = document.querySelector('#deep-nest-target');

    expect(target?.querySelector('#outer-if')).not.toBeNull();
    expect(target?.querySelector('#inner-if-list')).not.toBeNull();
    expect(target?.querySelectorAll('.deep-item').length).toBe(2);

    showItems.set(false);

    expect(target?.querySelector('#inner-if-list')).toBeNull();
    expect(target?.querySelector('#items-hidden')).not.toBeNull();

    showList.set(false);

    expect(target?.querySelector('#outer-if')).toBeNull();
    expect(target?.querySelector('#list-hidden')).not.toBeNull();
  });

  it('should hydrate aria-label attribute correctly', async () => {
    const label = Cell.source('Toggle button');
    const template = () => (
      <button id="aria-btn" type="button" aria-label={label}>
        Toggle
      </button>
    );

    const { document } = await setupHydration(template);
    const btn = document.querySelector('#aria-btn') as HTMLButtonElement;

    expect(btn.getAttribute('aria-label')).toBe('Toggle button');

    label.set('Close button');

    expect(btn.getAttribute('aria-label')).toBe('Close button');
  });

  it('should hydrate For and support item removal', async () => {
    const items = Cell.source(['A', 'B', 'C']);
    const template = () => (
      <ul id="removal-list">
        {For(items, (item) => (
          <li class="removal-item">{item}</li>
        ))}
      </ul>
    );

    const { document } = await setupHydration(template);
    const list = document.querySelector('#removal-list');

    expect(list?.querySelectorAll('.removal-item').length).toBe(3);

    // Remove middle item
    items.set(['A', 'C']);

    expect(list?.querySelectorAll('.removal-item').length).toBe(2);

    // Remove all
    items.set([]);

    expect(list?.querySelectorAll('.removal-item').length).toBe(0);

    // Add back
    items.set(['X', 'Y', 'Z']);

    expect(list?.querySelectorAll('.removal-item').length).toBe(3);
  });

  it('should hydrate shadowroots', async () => {
    const template = () => (
      <div id="parent">
        <ShadowRoot>Hello world.</ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#parent');

    expect(div).not.toBeNull();
    expect(div?.shadowRoot).not.toBeNull();
    expect(div?.shadowRoot?.textContent).toBe('Hello world.');
  });

  it('should hydrate shadowroots with children', async () => {
    const template = () => (
      <div id="parent">
        <ShadowRoot>
          <div id="child">Hello world.</div>
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#parent');

    expect(div).not.toBeNull();
    expect(div?.shadowRoot).not.toBeNull();
    expect(div?.shadowRoot?.querySelector('#child')).not.toBeNull();
    expect(div?.shadowRoot?.querySelector('#child')?.textContent).toBe(
      'Hello world.'
    );
  });

  it('should hydrate shadowroots with reactive content', async () => {
    const text = Cell.source('Initial');
    const template = () => (
      <div id="reactive-shadow-parent">
        <ShadowRoot>
          <span id="reactive-text">{text}</span>
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#reactive-shadow-parent');
    const span = div?.shadowRoot?.querySelector('#reactive-text');

    expect(span?.textContent).toBe('Initial');

    text.set('Updated');

    expect(span?.textContent).toBe('Updated');
  });

  it('should hydrate shadowroots with event listeners', async () => {
    const count = Cell.source(0);
    const template = () => (
      <div id="event-shadow-parent">
        <ShadowRoot>
          <button
            id="shadow-btn"
            type="button"
            onClick={() => count.set(count.get() + 1)}
          >
            Count: {count}
          </button>
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#event-shadow-parent');
    const btn = div?.shadowRoot?.querySelector(
      '#shadow-btn'
    ) as HTMLButtonElement;

    expect(btn.textContent).toBe('Count: 0');

    btn.click();

    expect(btn.textContent).toBe('Count: 1');
  });

  it('should hydrate nested shadowroots', async () => {
    const template = () => (
      <div id="outer-shadow-parent">
        <ShadowRoot>
          <div id="inner-shadow-parent">
            <ShadowRoot>
              <span id="nested-content">Nested shadow content</span>
            </ShadowRoot>
          </div>
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const outer = document.querySelector('#outer-shadow-parent');
    const inner = outer?.shadowRoot?.querySelector('#inner-shadow-parent');
    const content = inner?.shadowRoot?.querySelector('#nested-content');

    expect(outer?.shadowRoot).not.toBeNull();
    expect(inner?.shadowRoot).not.toBeNull();
    expect(content?.textContent).toBe('Nested shadow content');
  });

  it('should hydrate shadowroots with If control flow', async () => {
    const show = Cell.source(true);
    const template = () => (
      <div id="if-shadow-parent">
        <ShadowRoot>
          {If(show, {
            true: () => <span id="if-visible">Visible</span>,
            false: () => <span id="if-hidden">Hidden</span>,
          })}
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#if-shadow-parent');

    expect(div?.shadowRoot?.querySelector('#if-visible')).not.toBeNull();

    show.set(false);

    expect(div?.shadowRoot?.querySelector('#if-visible')).toBeNull();
    expect(div?.shadowRoot?.querySelector('#if-hidden')).not.toBeNull();
  });

  it('should hydrate shadowroots with For control flow', async () => {
    const items = Cell.source(['A', 'B', 'C']);
    const template = () => (
      <div id="for-shadow-parent">
        <ShadowRoot>
          <ul id="shadow-list">
            {For(items, (item) => (
              <li class="shadow-item">{item}</li>
            ))}
          </ul>
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#for-shadow-parent');
    const list = div?.shadowRoot?.querySelector('#shadow-list');

    expect(list?.querySelectorAll('.shadow-item').length).toBe(3);

    items.set(['A', 'B', 'C', 'D']);

    expect(list?.querySelectorAll('.shadow-item').length).toBe(4);

    items.set(['A']);

    expect(list?.querySelectorAll('.shadow-item').length).toBe(1);
  });

  it('should hydrate shadowroots with Switch control flow', async () => {
    const mode = Cell.source('a');
    const template = () => (
      <div id="switch-shadow-parent">
        <ShadowRoot>
          {Switch(mode, {
            a: () => <span id="shadow-mode-a">Mode A</span>,
            b: () => <span id="shadow-mode-b">Mode B</span>,
            c: () => <span id="shadow-mode-c">Mode C</span>,
          })}
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#switch-shadow-parent');

    expect(div?.shadowRoot?.querySelector('#shadow-mode-a')).not.toBeNull();

    mode.set('b');

    expect(div?.shadowRoot?.querySelector('#shadow-mode-a')).toBeNull();
    expect(div?.shadowRoot?.querySelector('#shadow-mode-b')).not.toBeNull();

    mode.set('c');

    expect(div?.shadowRoot?.querySelector('#shadow-mode-b')).toBeNull();
    expect(div?.shadowRoot?.querySelector('#shadow-mode-c')).not.toBeNull();
  });

  it('should hydrate shadowroots with dynamic attributes', async () => {
    const cls = Cell.source('initial-class');
    const title = Cell.source('Initial title');
    const template = () => (
      <div id="attr-shadow-parent">
        <ShadowRoot>
          <div id="shadow-attr-target" class={cls} title={title}>
            Content
          </div>
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#attr-shadow-parent');
    const target = div?.shadowRoot?.querySelector(
      '#shadow-attr-target'
    ) as HTMLElement;

    expect(target.className).toBe('initial-class');
    expect(target.title).toBe('Initial title');

    cls.set('updated-class');
    title.set('Updated title');

    expect(target.className).toBe('updated-class');
    expect(target.title).toBe('Updated title');
  });

  it('should hydrate shadowroots with dynamic styles', async () => {
    const color = Cell.source('red');
    const fontSize = Cell.source('16px');
    const template = () => (
      <div id="style-shadow-parent">
        <ShadowRoot>
          <div id="shadow-style-target" style={{ color, fontSize }}>
            Styled content
          </div>
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#style-shadow-parent');
    const target = div?.shadowRoot?.querySelector(
      '#shadow-style-target'
    ) as HTMLElement;

    expect(target.style.color).toBe('red');
    expect(target.style.fontSize).toBe('16px');

    color.set('blue');
    fontSize.set('20px');

    expect(target.style.color).toBe('blue');
    expect(target.style.fontSize).toBe('20px');
  });

  it('should hydrate shadowroots with Unique component', async () => {
    const count = Cell.source(0);
    const Component = createUnique(() => {
      return (
        <button
          id="shadow-unique-btn"
          type="button"
          onClick={() => count.set(count.get() + 1)}
        >
          Unique: {count}
        </button>
      );
    });

    const template = () => (
      <div id="unique-shadow-parent">
        <ShadowRoot>
          <Component />
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#unique-shadow-parent');
    const btn = div?.shadowRoot?.querySelector(
      '#shadow-unique-btn'
    ) as HTMLButtonElement;

    expect(btn.textContent).toBe('Unique: 0');

    btn.click();

    expect(btn.textContent).toBe('Unique: 1');
  });

  it('should hydrate shadowroots with mixed static and dynamic content', async () => {
    const dynamicText = Cell.source('Dynamic');
    const template = () => (
      <div id="mixed-shadow-parent">
        <ShadowRoot>
          <div id="shadow-mixed">
            <span>Static 1</span>
            {dynamicText}
            <span>Static 2</span>
          </div>
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#mixed-shadow-parent');
    const mixed = div?.shadowRoot?.querySelector('#shadow-mixed');

    expect(mixed?.textContent).toBe('Static 1DynamicStatic 2');

    dynamicText.set('Modified');

    expect(mixed?.textContent).toBe('Static 1ModifiedStatic 2');
  });

  it('should hydrate shadowroots with complex nested control flow', async () => {
    const mode = Cell.source('list');
    const show = Cell.source(true);
    const items = Cell.source(['Item 1', 'Item 2']);

    const template = () => (
      <div id="complex-shadow-parent">
        <ShadowRoot>
          {Switch(mode, {
            list: () =>
              If(show, {
                true: () => (
                  <ul id="shadow-complex-list">
                    {For(items, (item) => (
                      <li class="shadow-complex-item">{item}</li>
                    ))}
                  </ul>
                ),
                false: () => <div id="shadow-complex-hidden">Hidden</div>,
              }),
            other: () => <div id="shadow-complex-other">Other</div>,
          })}
        </ShadowRoot>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#complex-shadow-parent');
    const shadowRoot = div?.shadowRoot;

    expect(shadowRoot?.querySelectorAll('.shadow-complex-item').length).toBe(2);

    items.set(['Item 1', 'Item 2', 'Item 3']);

    expect(shadowRoot?.querySelectorAll('.shadow-complex-item').length).toBe(3);

    show.set(false);

    expect(shadowRoot?.querySelector('#shadow-complex-list')).toBeNull();
    expect(shadowRoot?.querySelector('#shadow-complex-hidden')).not.toBeNull();

    mode.set('other');

    expect(shadowRoot?.querySelector('#shadow-complex-hidden')).toBeNull();
    expect(shadowRoot?.querySelector('#shadow-complex-other')).not.toBeNull();
  });

  it('should hydrate shadowroots with light DOM content (default slot)', async () => {
    const template = () => (
      <div id="slot-shadow-parent">
        <ShadowRoot>
          <div id="shadow-wrapper">
            <slot />
          </div>
        </ShadowRoot>
        <span id="light-dom-content">Light DOM content</span>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#slot-shadow-parent');
    const shadowWrapper = div?.shadowRoot?.querySelector('#shadow-wrapper');
    const lightContent = div?.querySelector('#light-dom-content');

    expect(shadowWrapper).not.toBeNull();
    expect(lightContent).not.toBeNull();
    expect(lightContent?.textContent).toBe('Light DOM content');
  });

  it('should hydrate shadowroots with named slots', async () => {
    const template = () => (
      <div id="named-slot-parent">
        <ShadowRoot>
          <header>
            <slot name="header" />
          </header>
          <main>
            <slot />
          </main>
          <footer>
            <slot name="footer" />
          </footer>
        </ShadowRoot>
        <span slot="header" id="header-content">
          Header
        </span>
        <span id="main-content">Main content</span>
        <span slot="footer" id="footer-content">
          Footer
        </span>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#named-slot-parent');

    expect(div?.querySelector('#header-content')?.textContent).toBe('Header');
    expect(div?.querySelector('#main-content')?.textContent).toBe(
      'Main content'
    );
    expect(div?.querySelector('#footer-content')?.textContent).toBe('Footer');
    expect(div?.shadowRoot?.querySelector('header')).not.toBeNull();
    expect(div?.shadowRoot?.querySelector('main')).not.toBeNull();
    expect(div?.shadowRoot?.querySelector('footer')).not.toBeNull();
  });

  it('should hydrate shadowroots with reactive light DOM content', async () => {
    const text = Cell.source('Initial light');
    const template = () => (
      <div id="reactive-light-parent">
        <ShadowRoot>
          <div id="shadow-container">
            <slot />
          </div>
        </ShadowRoot>
        <span id="reactive-light">{text}</span>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#reactive-light-parent');
    const lightSpan = div?.querySelector('#reactive-light');

    expect(lightSpan?.textContent).toBe('Initial light');

    text.set('Updated light');

    expect(lightSpan?.textContent).toBe('Updated light');
  });

  it('should hydrate shadowroots with reactive shadow and light DOM content', async () => {
    const shadowText = Cell.source('Shadow content');
    const lightText = Cell.source('Light content');
    const template = () => (
      <div id="mixed-reactive-parent">
        <ShadowRoot>
          <div id="shadow-part">{shadowText}</div>
          <slot />
        </ShadowRoot>
        <span id="light-part">{lightText}</span>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#mixed-reactive-parent');
    const shadowPart = div?.shadowRoot?.querySelector('#shadow-part');
    const lightPart = div?.querySelector('#light-part');

    expect(shadowPart?.textContent).toBe('Shadow content');
    expect(lightPart?.textContent).toBe('Light content');

    shadowText.set('Updated shadow');
    lightText.set('Updated light');

    expect(shadowPart?.textContent).toBe('Updated shadow');
    expect(lightPart?.textContent).toBe('Updated light');
  });

  it('should hydrate shadowroots with For loop in light DOM', async () => {
    const items = Cell.source(['A', 'B', 'C']);
    const template = () => (
      <div id="for-light-parent">
        <ShadowRoot>
          <div id="shadow-header">Header</div>
          <slot />
        </ShadowRoot>
        <ul id="light-list">
          {For(items, (item) => (
            <li class="light-item">{item}</li>
          ))}
        </ul>
      </div>
    );

    const { document } = await setupHydration(template);
    const div = document.querySelector('#for-light-parent');
    const list = div?.querySelector('#light-list');

    expect(list?.querySelectorAll('.light-item').length).toBe(3);

    items.set(['A', 'B', 'C', 'D']);

    expect(list?.querySelectorAll('.light-item').length).toBe(4);

    items.set(['A']);

    expect(list?.querySelectorAll('.light-item').length).toBe(1);
  });

  it('should hydrate shadowroots with event listeners on light DOM', async () => {
    const count = Cell.source(0);
    const template = () => (
      <div id="event-light-parent">
        <ShadowRoot>
          <slot />
        </ShadowRoot>
        <button
          id="light-btn"
          type="button"
          onClick={() => count.set(count.get() + 1)}
        >
          Light count: {count}
        </button>
      </div>
    );

    const { document } = await setupHydration(template);
    const btn = document.querySelector('#light-btn') as HTMLButtonElement;

    expect(btn.textContent).toBe('Light count: 0');

    btn.click();

    expect(btn.textContent).toBe('Light count: 1');
  });
});
