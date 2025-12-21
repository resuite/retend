import { Cell, For, If, getActiveRenderer } from 'retend';
import type { DOMRenderer } from 'retend-web';
import { renderToString } from 'retend-server/client';
import { ShadowRoot } from 'retend-web';
import { describe, expect, it } from 'vitest';
import { browserSetup, timeout, vDomSetup } from './setup.tsx';

const runTests = () => {
  it('should render basic JSX elements to strings', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = <div class="test">Hello World</div>;
    const result = await renderToString(element, window);
    expect(result).toBe('<div class="test">Hello World</div>');
  });

  it('should mark static nodes when option is enabled', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <span>Static content</span>
        <span>{Cell.source('Dynamic content')}</span>
      </div>
    );
    const result = await renderToString(element, window, {
      markStaticNodes: true,
    });
    expect(result).toContain('<span data-static>Static content</span>');
    expect(result).not.toContain('<span data-static>Dynamic content</span>');
  });

  it('should skip reactive nodes when marking static nodes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <span>{Cell.source('Dynamic content')}</span>
        <span>Static Content</span>
      </div>
    );
    const result = await renderToString(element, window, {
      markStaticNodes: true,
    });
    expect(result).toContain(
      '<div><span>Dynamic content</span><span data-static>Static Content</span></div>'
    );
  });

  it('should skip nodes with event listeners when marking static nodes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <button type="button" onClick={() => console.log('Clicked!')}>
          Click me
        </button>
        <p>
          This is a paragraph with a <a href="https://example.com">link</a>.
        </p>
      </div>
    );
    const result = await renderToString(element, window, {
      markStaticNodes: true,
    });
    expect(result).toContain(
      '<div><button type="button">Click me</button><p data-static>This is a paragraph with a <a href="https://example.com">link</a>.</p></div>'
    );
  });

  it('should preserve whitespace between text nodes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        Hello {'World'}
        {'!'}
      </div>
    );
    const result = await renderToString(element, window);
    expect(result).toContain('<div>Hello <!--@@-->World<!--@@-->!</div>');
  });

  it('should handle void elements correctly', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <img src="test.jpg" alt="Test illustration" />
        <br />
        <input type="text" />
      </div>
    );
    const result = await renderToString(element, window);
    expect(result).toBe(
      '<div><img src="test.jpg" alt="Test illustration"/><br/><input type="text"/></div>'
    );
  });

  it('should handle nested fragments', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <>
        <div>First</div>
        <>
          <div>Second</div>
          <div>Third</div>
        </>
      </>
    );
    const result = await renderToString(element, window);
    expect(result).toBe('<div>First</div><div>Second</div><div>Third</div>');
  });

  it('should handle promises in JSX', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = <div>{Promise.resolve('Async content')}</div>;
    const result = await renderToString(element, window);
    expect(result).toBe('<div>Async content</div>');
  });

  it('should handle component promises in JSX', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const Component = async () => {
      await timeout();
      return <div>Async content</div>;
    };
    const element = (
      <div>
        <Component />
      </div>
    );
    const result = await renderToString(element, window);
    expect(result).toBe('<div><div>Async content</div></div>');
  });

  it('should handle component promises in JSX with children', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const Component = async (props: { children?: unknown }) => {
      await timeout();
      return <div>Async content: {props.children}</div>;
    };
    const element = (
      <div>
        <Component>
          <p>Child</p>
        </Component>
      </div>
    );
    const result = await renderToString(element, window);
    expect(result).toBe('<div><div>Async content: <p>Child</p></div></div>');
  });

  it('should handle nested async components in JSX', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const ChildComponent = async () => {
      await timeout();
      return <span>Child async content</span>;
    };
    const ParentComponent = async () => {
      await timeout();
      return (
        <div>
          Parent async content
          <ChildComponent />
        </div>
      );
    };
    const element = (
      <div>
        <ParentComponent />
      </div>
    );
    const result = await renderToString(element, window);
    expect(result).toBe(
      '<div><div>Parent async content<span>Child async content</span></div></div>'
    );
  });

  it('should handle fragments with async components', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const AsyncComponent = async () => {
      await timeout();
      return <div>Async content</div>;
    };
    const element = (
      <>
        <div>Static content</div>
        <AsyncComponent />
      </>
    );
    const result = await renderToString(element, window);
    expect(result).toBe('<div>Static content</div><div>Async content</div>');
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
    const result = await renderToString(element, window);
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
    const result = await renderToString(element, window);
    expect(result).toBe(
      '<div id="test" class="test-class" data-test="value">Content</div>'
    );
  });

  it('should handle elements with special characters', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = <div>Special characters: &amp; &lt; &gt; " '</div>;
    const result = await renderToString(element, window);
    expect(result).toBe(
      '<div>Special characters: &amp; &lt; &gt; &quot; &apos;</div>'
    );
  });

  it('should handle elements with boolean attributes', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = <input type="checkbox" checked />;
    const result = await renderToString(element, window);
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
    const result = await renderToString(element, window);
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
    const result = await renderToString(element, window);
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
    const result = await renderToString(element, window);
    expect(result).toBe('<div><span>Conditional content</span></div>');
  });

  it('should mark static nodes inside shadow root when enabled', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <ShadowRoot>
          <div>Static content</div>
        </ShadowRoot>
      </div>
    );
    const result = await renderToString(element, window, {
      markStaticNodes: true,
    });
    expect(result).toBe(
      '<div data-static><template shadowrootmode="open"><div>Static content</div></template></div>'
    );
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
    const result = await renderToString(element, window);
    expect(result).toBe(
      '<div><template shadowrootmode="open"><div>Shadow content</div></template><div>Normal content</div></div>'
    );
  });

  it('should handle static marking in nested shadow roots', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <ShadowRoot>
          <div data-outer>
            <ShadowRoot>
              <div>Static inner</div>
            </ShadowRoot>
            <span>Static outer</span>
          </div>
        </ShadowRoot>
      </div>
    );
    const result = await renderToString(element, window, {
      markStaticNodes: true,
    });
    expect(result).toBe(
      '<div data-static><template shadowrootmode="open"><div data-outer="true"><template shadowrootmode="open"><div>Static inner</div></template><span>Static outer</span></div></template></div>'
    );
  });

  it('should not mark nodes with event listeners as static in shadow root', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <ShadowRoot>
          <button type="button" onClick={() => {}}>
            Click me
          </button>
          <div>Static content</div>
        </ShadowRoot>
      </div>
    );
    const result = await renderToString(element, window, {
      markStaticNodes: true,
    });
    expect(result).toBe(
      '<div><template shadowrootmode="open"><button type="button">Click me</button><div>Static content</div></template></div>'
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
    const result = await renderToString(element, window);
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
    const result = await renderToString(element, window);
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
    const result = await renderToString(element, window);
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
    const result = await renderToString(element, window);
    expect(result).toBe(
      '<div><template shadowrootmode="open"><div>Dynamic content</div></template></div>'
    );
  });

  it('should not mark shadowroot parent as static if it has reactive children', async () => {
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
    const result = await renderToString(element, window, {
      markStaticNodes: true,
    });
    expect(result).toBe(
      '<div><template shadowrootmode="open"><div>Dynamic content</div></template></div>'
    );
  });

  it('should mark shadowroot parent as static if it has static children', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    const element = (
      <div>
        <ShadowRoot>
          <div>Static content</div>
        </ShadowRoot>
      </div>
    );
    const result = await renderToString(element, window, {
      markStaticNodes: true,
    });
    expect(result).toBe(
      '<div data-static><template shadowrootmode="open"><div>Static content</div></template></div>'
    );
  });

  it('should correctly serialize upper case attribute names', async () => {
    const renderer = getActiveRenderer() as DOMRenderer;
    const { host: window } = renderer;
    //@ts-ignore: testing
    const element = <div AttrName="test" Other="test" />;

    const result = await renderToString(element, window);
    expect(result).toBe('<div attr-name="test" other="test"></div>');
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
});
