import {
  Cell,
  For,
  If,
  type SourceCell,
  Switch,
  Unique,
  getActiveRenderer,
  setActiveRenderer,
} from 'retend';
import { DOMRenderer, Teleport } from 'retend-web';
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
  document.body.innerHTML = `<div id="app">${html}</div>`;
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
    const template = () => (
      <div>
        <Unique id="unique-comp" name="test-unique">
          {() => (
            <button
              id="unique-btn"
              type="button"
              onClick={() => count.set(count.get() + 1)}
            >
              Unique: {count}
            </button>
          )}
        </Unique>
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
    const template = () => (
      <div>
        <div id="unique-target" />
        <Teleport to="#unique-target">
          <Unique id="teleported-unique" name="test">
            {() => (
              <button
                id="teleport-btn"
                type="button"
                onClick={() => count.set(count.get() + 1)}
              >
                Count: {count}
              </button>
            )}
          </Unique>
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
    const template = () => (
      <div>
        <div id="unique-for-target" />
        <Teleport to="#unique-for-target">
          <div>
            {For(items, (item, index) => (
              <Unique id={`item-${item}`} name={`unique-${index}`}>
                {() => (
                  <div class="unique-item" id={`item-el-${item}`}>
                    Item: {item}
                  </div>
                )}
              </Unique>
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
});
