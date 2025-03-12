import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getGlobalContext,
  Modes,
  resetGlobalContext,
  setGlobalContext,
  For,
  If,
} from '@adbl/unfinished';
import { renderToString } from '@adbl/unfinished/render';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { Cell } from '@adbl/cells';
import { VWindow } from '@adbl/unfinished/v-dom';

const runTests = () => {
  it('should render basic JSX elements to strings', async () => {
    const { window } = getGlobalContext();
    const element = <div class="test">Hello World</div>;
    const result = await renderToString(element, window);
    expect(result).toBe('<div class="test">Hello World</div>');
  });

  it('should mark static nodes when option is enabled', async () => {
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
    const element = <div>{Promise.resolve('Async content')}</div>;
    const result = await renderToString(element, window);
    expect(result).toBe('<div>Async content</div>');
  });

  it('should handle component promises in JSX', async () => {
    const { window } = getGlobalContext();
    const Component = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
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
    const { window } = getGlobalContext();
    const Component = async (props: { children?: unknown }) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
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
    const { window } = getGlobalContext();
    const ChildComponent = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return <span>Child async content</span>;
    };
    const ParentComponent = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
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
    const { window } = getGlobalContext();
    const AsyncComponent = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
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
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
    const element = <div>Special characters: &amp; &lt; &gt; " '</div>;
    const result = await renderToString(element, window);
    expect(result).toBe(
      '<div>Special characters: &amp; &lt; &gt; &quot; &apos;</div>'
    );
  });

  it('should handle elements with boolean attributes', async () => {
    const { window } = getGlobalContext();
    const element = <input type="checkbox" checked />;
    const result = await renderToString(element, window);
    expect(result).toBe('<input type="checkbox" checked="true"/>');
  });

  it('should handle arrays of elements', async () => {
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
    const { window } = getGlobalContext();
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
};

describe('JSX Serialization', () => {
  describe('Happy DOM window', () => {
    beforeAll(() => {
      GlobalRegistrator.register();
    });

    beforeEach(() => {
      setGlobalContext({
        window,
        mode: Modes.Interactive,
        teleportIdCounter: { value: 0 },
        consistentValues: new Map(),
      });
    });

    runTests();

    afterAll(() => {
      GlobalRegistrator.unregister();
      resetGlobalContext();
    });
  });

  describe('VDom', () => {
    beforeEach(() => {
      setGlobalContext({
        window: new VWindow(),
        consistentValues: new Map(),
        mode: Modes.VDom,
        teleportIdCounter: { value: 0 },
      });
    });

    runTests();

    afterAll(() => {
      resetGlobalContext();
    });
  });
});
