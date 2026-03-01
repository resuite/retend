import type { VDOMRenderer, VWindow } from 'retend-server/v-dom';
import type { DOMRenderer } from 'retend-web';
import type { JSX } from 'retend/jsx-runtime';

import { Cell, For, If, getActiveRenderer } from 'retend';
import { renderToString } from 'retend-server/client';
import { ShadowRoot } from 'retend-web';
import { describe, expect, it } from 'vitest';

import { browserSetup, vDomSetup } from './setup.tsx';

const toString = (template: JSX.Template, window: Window | VWindow) => {
  const renderer = getActiveRenderer() as DOMRenderer | VDOMRenderer;
  return renderToString(
    renderer.render(template),
    window as Parameters<typeof renderToString>[1]
  );
};

const runTests = () => {
  it('should render basic JSX elements to strings', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const result = toString(<div class="test">Hello World</div>, window);
    expect(result).toBe('<div class="test">Hello World</div>');
  });

  it('should preserve whitespace between text nodes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const template = (
      <div>
        Hello {'World'}
        {'!'}
      </div>
    );
    const result = toString(template, window);
    expect(result).toContain('<div>Hello <!--@@-->World<!--@@-->!</div>');
  });

  it('should handle void elements correctly', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const template = (
      <div>
        <img src="test.jpg" alt="Test illustration" />
        <br />
        <input type="text" />
      </div>
    );
    const result = toString(template, window);
    expect(result).toBe(
      '<div><img src="test.jpg" alt="Test illustration"/><br/><input type="text"/></div>'
    );
  });

  it('should handle nested fragments', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const template = (
      <>
        <div>First</div>
        <>
          <div>Second</div>
          <div>Third</div>
        </>
      </>
    );
    const result = toString(template, window);
    expect(result).toBe('<div>First</div><div>Second</div><div>Third</div>');
  });

  it('should handle deeply nested elements', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <div>
          <div>
            <div>
              <div>Deeply nested content</div>
            </div>
          </div>
        </div>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div><div><div><div><div>Deeply nested content</div></div></div></div></div>'
    );
  });

  it('should handle elements with multiple attributes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div id="test" class="test-class" data-test="value">
        Content
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div id="test" class="test-class" data-test="value">Content</div>'
    );
  });

  it('should handle elements with special characters', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = <div>Special characters: &amp; &lt; &gt; " '</div>;
    const result = toString(element, window);
    expect(result).toBe(
      '<div>Special characters: &amp; &lt; &gt; &quot; &apos;</div>'
    );
  });

  it('should handle elements with boolean attributes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = <input type="checkbox" checked />;
    const result = toString(element, window);
    expect(result).toBe('<input type="checkbox" checked="true"/>');
  });

  it('should handle arrays of elements', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const items = ['Item 1', 'Item 2', 'Item 3'];
    const element = (
      <ul>
        {For(items, (item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>'
    );
  });

  it('should handle null and undefined values gracefully', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        {null}
        {undefined}
        <span>Valid content</span>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe('<div><span>Valid content</span></div>');
  });

  it('should handle conditional rendering', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const showContent = true;
    const element = (
      <div>
        {If(showContent, {
          true: () => <span>Conditional content</span>,
          false: () => <span>Alternative content</span>,
        })}
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe('<div><span>Conditional content</span></div>');
  });

  it('should hoist shadow roots to the start of the parent node', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <div>Normal content</div>
        <ShadowRoot>
          <div>Shadow content</div>
        </ShadowRoot>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div><template shadowrootmode="open"><div>Shadow content</div></template><div>Normal content</div></div>'
    );
  });

  it('should serialize shadow root content', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <ShadowRoot>
          <div>Shadow content</div>
        </ShadowRoot>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div><template shadowrootmode="open"><div>Shadow content</div></template></div>'
    );
  });

  it('should serialize shadow root with styles', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <ShadowRoot>
          <style>{'.test { color: red; }'}</style>
          <div class="test">Styled content</div>
        </ShadowRoot>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div><template shadowrootmode="open"><style>.test { color: red; }</style><div class="test">Styled content</div></template></div>'
    );
  });

  it('should serialize nested shadow roots', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <ShadowRoot>
          <div>
            Outer content
            <ShadowRoot>
              <div>Inner content</div>
            </ShadowRoot>
          </div>
        </ShadowRoot>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div><template shadowrootmode="open"><div><template shadowrootmode="open"><div>Inner content</div></template>Outer content</div></template></div>'
    );
  });

  it('should serialize shadow roots with reactive content', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const content = Cell.source('Dynamic content');
    const element = (
      <div>
        <ShadowRoot>
          <div>{content}</div>
        </ShadowRoot>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div><template shadowrootmode="open"><div>Dynamic content</div></template></div>'
    );
  });

  it('should correctly serialize upper case attribute names', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    //@ts-ignore: testing
    const element = <div AttrName="test" Other="test" />;

    const result = toString(element, window);
    expect(result).toBe('<div attr-name="test" other="test"></div>');
  });
};

const dynamicTests = () => {
  it('should mark elements with event listeners as dynamic when option is enabled', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = (
      <button type="button" onClick={() => {}}>
        Click me
      </button>
    );
    const result = toString(element, window);
    expect(result).toContain(
      '<button data-dyn="0.0" type="button">Click me</button>'
    );
  });

  it('should mark elements with reactive attributes as dynamic when option is enabled', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = <div class={Cell.source('test-class')}>Content</div>;
    const result = toString(element, window);
    expect(result).toContain(
      '<div data-dyn="0.0" class="test-class">Content</div>'
    );
  });

  it('should mark element as reactive if it has a reactive attribute', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = <div title={Cell.source('dynamic-title')}>Content</div>;
    const result = toString(element, window);
    expect(result).toContain('data-dyn="0.0"');
  });

  it('should mark an element as dynamic if it is held by a ref', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const ref = Cell.source('dynamic-ref');
    const element = <div ref={ref}>Content</div>;
    const result = toString(element, window);
    expect(result).toContain('data-dyn="0.0"');
  });

  it('should not mark static elements as dynamic when option is enabled', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = <div class="static">Static content</div>;
    const result = toString(element, window);
    expect(result).not.toContain('data-dyn');
  });

  it('should assign incremental dynamic ids to multiple dynamic elements', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <button type="button" onClick={() => {}}>
          Button 1
        </button>
        <div class={Cell.source('class1')}>Div 1</div>
        <span>Static</span>
        <button type="button" onClick={() => {}}>
          Button 2
        </button>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div><button data-dyn="0.0" type="button">Button 1</button><div data-dyn="0.1" class="class1">Div 1</div><span>Static</span><button data-dyn="0.2" type="button">Button 2</button></div>'
    );
  });

  it('should mark elements with reactive text content as dynamic if they have dynamic text node children', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = <div>{Cell.source('Dynamic text')}</div>;
    const result = toString(element, window);
    expect(result).toContain('<div data-dyn');
  });

  it('should only consider immediate children when checking for dynamism', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <div>
          <button type="button" onClick={() => {}}>
            Click
          </button>
        </div>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      '<div><div><button data-dyn="0.0" type="button">Click</button></div></div>'
    );
  });

  it('should mark the container for a For loop as reactive', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const items = Cell.source(['Item 1']);
    const element = (
      <ul>
        {For(items, (item) => (
          <li>{item}</li>
        ))}
      </ul>
    );
    const result = toString(element, window);
    expect(result).toContain('<ul data-dyn="0.0">');
  });

  it('should mark the container for a If as reactive', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const condition = Cell.source(true);
    const element = (
      <div>
        {If(condition, {
          true: () => <span>True</span>,
        })}
      </div>
    );
    const result = toString(element, window);
    expect(result).toContain('<div data-dyn="0.0">');
  });

  it('should mark an element as reactive if it has a shadowroot', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <ShadowRoot>
          <div>Shadow content</div>
        </ShadowRoot>
      </div>
    );
    const result = toString(element, window);
    expect(result).toContain('<div data-dyn="0.0">');
  });

  it('should increment for very large subtrees', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const size = 100;
    const element = (
      <div>
        {For(Array.from({ length: size }), (i) => (
          <div onClick={() => {}}>{i}</div>
        ))}
      </div>
    );
    const result = toString(element, window);
    for (let i = 0; i < size; i++) {
      expect(result).toContain(`data-dyn="0.${i}"`);
    }
  });

  it('should handle deeply nested dynamic elements', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div onClick={() => {}}>
        <div onClick={() => {}}>
          <div onClick={() => {}}>
            <div onClick={() => {}}>
              <div onClick={() => {}}>Deeply nested</div>
            </div>
          </div>
        </div>
      </div>
    );
    const result = toString(element, window);
    for (let i = 0; i < 5; i++) {
      expect(result).toContain(`data-dyn="0.${i}"`);
    }
  });
};

const multiDimensionalMarkerTests = () => {
  it('should use multi-dimensional markers for For loop items', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;

    const items = Cell.source(['Item 1', 'Item 2', 'Item 3']);
    const element = (
      <div>
        {For(items, (item) => (
          <button key={item} type="button" onClick={() => {}}>
            {item}
          </button>
        ))}
      </div>
    );
    const result = toString(element, window);
    // Container gets data-dyn="0.0", items get data-dyn="0.0.X.0" format
    expect(result).toContain('data-dyn="0.0"');
    expect(result).toMatch(/data-dyn="0\.0\.\d+\.0"/);
  });

  it('should use multi-dimensional markers for If branches', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;

    const condition = Cell.source(true);
    const element = (
      <div>
        {If(condition, {
          true: () => <button onClick={() => {}}>True Button</button>,
          false: () => <button onClick={() => {}}>False Button</button>,
        })}
      </div>
    );
    const result = toString(element, window);
    // Container gets data-dyn="0.0", if branch gets data-dyn="0.0.X" format (shorter than For loops)
    expect(result).toContain('data-dyn="0.0"');
    expect(result).toMatch(/data-dyn="0\.0\.\d+"/);
  });

  it('should create separate branches for multiple For loops', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;

    const items1 = Cell.source(['a', 'b']);
    const items2 = Cell.source(['c', 'd']);
    const element = (
      <div>
        {For(items1, (item) => (
          <span key={item} onClick={() => {}}>
            {item}
          </span>
        ))}
        {For(items2, (item) => (
          <span key={item} onClick={() => {}}>
            {item}
          </span>
        ))}
      </div>
    );
    const result = toString(element, window);
    // Container gets data-dyn="0.0", each For loop creates its own branch
    expect(result).toContain('data-dyn="0.0"');
    expect(result).toMatch(/data-dyn="0\.0\.\d+\.0"/);
    expect(result).toMatch(/data-dyn="0\.1\.\d+\.0"/);
  });

  it('should handle nested For loops with multi-dimensional markers', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;

    const outerItems = Cell.source(['X', 'Y']);
    const innerItems = ['1', '2'];
    const element = (
      <div>
        {For(outerItems, (outer) => (
          <div key={outer}>
            <button onClick={() => {}}>Outer {outer}</button>
            {For(innerItems, (inner) => (
              <span key={inner} onClick={() => {}}>
                {outer}-{inner}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
    const result = toString(element, window);
    // Container: data-dyn="0.0"
    // Outer loop items: data-dyn="0.0.X.0" (where X is the item index)
    // Inner loop items: data-dyn="0.0.X.Y" (where Y is the inner item index within that outer item)
    expect(result).toContain('data-dyn="0.0"');
    expect(result).toMatch(/data-dyn="0\.0\.\d+\.0"/);
    expect(result).toMatch(/data-dyn="0\.0\.\d+\.1"/);
    expect(result).toMatch(/data-dyn="0\.0\.\d+\.2"/);
  });

  it('should increment indices correctly within a branch', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;

    const items = Cell.source(['Item 1', 'Item 2', 'Item 3']);
    const element = (
      <div>
        {For(items, (item, _index) => (
          <button key={item} type="button" onClick={() => {}}>
            {item}
          </button>
        ))}
      </div>
    );
    const result = toString(element, window);
    // Container: data-dyn="0.0"
    // Each item gets data-dyn="0.0.X.0" where X is the item index
    expect(result).toContain('data-dyn="0.0"');
    expect(result).toMatch(/data-dyn="0\.0\.0\.0"/);
    expect(result).toMatch(/data-dyn="0\.0\.1\.0"/);
    expect(result).toMatch(/data-dyn="0\.0\.2\.0"/);
  });

  it('should handle For with reactive items and dynamic children', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;

    const items = Cell.source(['a', 'b']);
    const element = (
      <ul>
        {For(items, (item) => (
          <li key={item}>
            <button onClick={() => {}}>{item}</button>
            <span class={Cell.source('class-' + item)}>Text</span>
          </li>
        ))}
      </ul>
    );
    const result = toString(element, window);
    // Container: data-dyn="0.0"
    // Each li contains multiple dynamic elements with sequential indices
    expect(result).toContain('data-dyn="0.0"');
    expect(result).toMatch(/data-dyn="0\.0\.\d+\.0"/);
    expect(result).toMatch(/data-dyn="0\.0\.\d+\.1"/);
  });

  it('should handle deeply nested control flow structures', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;

    const items = Cell.source(['a']);
    const condition = Cell.source(true);
    const element = (
      <div>
        {For(items, (item) => (
          <div key={item}>
            {If(condition, {
              true: () => (
                <span>
                  <button onClick={() => {}}>Deep</button>
                </span>
              ),
            })}
          </div>
        ))}
      </div>
    );
    const result = toString(element, window);
    // Container: data-dyn="0.0"
    // For item: data-dyn="0.0.X.0"
    // If branch: data-dyn="0.0.X.0.Y.0"
    // Button: data-dyn="0.0.X.0.Y.0.Z.0"
    expect(result).toContain('data-dyn="0.0"');
    expect(result).toMatch(/data-dyn="0\.0\.\d+\.0"/);
  });
};

describe('JSX Serialization', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });

  describe('VDom (Dynamic)', () => {
    vDomSetup({ markDynamicNodes: true });
    dynamicTests();
    multiDimensionalMarkerTests();
  });
});
