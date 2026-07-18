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
    expect(result).toContain(
      '<div>Hello <!--retend:text-separator-->World<!--retend:text-separator-->!</div>'
    );
  });

  it('preserves a whitespace-only text node between text and an element', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const template = (
      <p>
        Coordinate loading states with <code>{'<Await>'}</code>. Nested async
        data.
      </p>
    );
    const result = toString(template, window);

    expect(result).toBe(
      '<p>Coordinate loading states with<!--retend:text-separator--> <code>&lt;Await&gt;</code>. Nested async data.</p>'
    );
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

  it('should not escape raw text inside script and style tags', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const scriptContent =
      "(function(){var theme=localStorage.getItem('retend-theme');if(theme === '\\\"dark\\\"' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}})();";
    const styleContent = `.test::before{content:"<>&'";}`;
    const element = (
      <div>
        <script>{scriptContent}</script>
        <style>{styleContent}</style>
      </div>
    );
    const result = toString(element, window);
    expect(result).toBe(
      `<div><script>${scriptContent}</script><style>${styleContent}</style></div>`
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

const reactiveTests = () => {
  it('serializes elements with event listeners', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = (
      <button type="button" onClick={() => {}}>
        Click me
      </button>
    );
    const result = toString(element, window);

    expect(result).toBe('<button type="button">Click me</button>');
  });

  it('serializes reactive attributes at their current value', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = <div class={Cell.source('test-class')}>Content</div>;
    const result = toString(element, window);

    expect(result).toBe('<div class="test-class">Content</div>');
  });

  it('serializes reactive control flow with structural ranges', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const items = Cell.source(['Item 1']);
    const condition = Cell.source(true);
    const element = (
      <div>
        <ul>
          {For(items, (item) => (
            <li>{item}</li>
          ))}
        </ul>
        {If(condition, {
          true: () => <span>True</span>,
        })}
      </div>
    );
    const result = toString(element, window);

    expect(result).toBe(
      '<div><ul><!--retend:range-start--><li>Item 1</li><!--retend:range-end--></ul><!--retend:range-start--><span>True</span><!--retend:range-end--></div>'
    );
  });

  it('serializes nested reactive ranges', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const items = Cell.source(['a']);
    const condition = Cell.source(true);
    const element = (
      <div>
        {For(items, (item) => (
          <div key={item}>
            {If(condition, {
              true: () => <button onClick={() => {}}>Deep</button>,
            })}
          </div>
        ))}
      </div>
    );
    const result = toString(element, window);

    expect(result).toBe(
      '<div><!--retend:range-start--><div><!--retend:range-start--><button>Deep</button><!--retend:range-end--></div><!--retend:range-end--></div>'
    );
  });

  it('serializes an empty reactive text slot explicitly', async () => {
    const renderer = getActiveRenderer() as VDOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        {Cell.source('')}
        <span>Next</span>
      </div>
    );
    const result = toString(element, window);

    expect(result).toBe('<div><!--retend:empty-text--><span>Next</span></div>');
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

  describe('VDom (Reactive)', () => {
    vDomSetup();
    reactiveTests();
  });
});
