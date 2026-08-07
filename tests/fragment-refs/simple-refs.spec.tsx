import type { JSX } from 'retend/jsx-runtime';

import { Cell, Fragment, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, textOf, vDomSetup, type NodeLike } from '../setup.tsx';

const runTests = () => {
  it('should track fragment refs with single element children', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const App = () => {
      return (
        <Fragment ref={ref}>
          <div>Hello, world!</div>
        </Fragment>
      );
    };

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toBeDefined();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
  });

  it('should track forwarded fragment refs in props.children', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const App = (props: { children: JSX.Children }) => {
      const { children } = props;
      return <Fragment ref={ref}>{children}</Fragment>;
    };

    renderer.render(
      <App>
        <div>Hello, world!</div>
      </App>
    );
    const nodes = ref.get();
    expect(nodes).toBeDefined();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
  });

  it('should track multiple element children in order', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const App = () => {
      return (
        <Fragment ref={ref}>
          <div>a</div>
          <span>b</span>
          <p>c</p>
        </Fragment>
      );
    };

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(3);
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      'a',
      'b',
      'c',
    ]);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should track text node children', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<unknown[] | null>(null);
    const App = () => {
      return <Fragment ref={ref}>Hello</Fragment>;
    };

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).not.toBeInstanceOf(renderer.host.HTMLElement);
    expect((nodes![0] as Node).nodeType).toBe(renderer.host.Node.TEXT_NODE);
    expect((nodes![0] as Node).textContent).toBe('Hello');
  });

  it('should track mixed text and element children in order', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const App = () => {
      return (
        <Fragment ref={ref}>
          <div>a</div>
          {'text'}
          <span>b</span>
        </Fragment>
      );
    };

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(3);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('a');
    expect(nodes![1].nodeType).toBe(renderer.host.Node.TEXT_NODE);
    expect(nodes![1].textContent).toBe('text');
    expect(nodes![2]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![2] as NodeLike)).toBe('b');
  });

  it('should resolve empty fragments to an empty array', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const App = () => {
      return <Fragment ref={ref} />;
    };

    renderer.render(<App />);
    expect(ref.get()).toEqual([]);
  });

  it('should resolve null children to an empty array', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const App = () => {
      return <Fragment ref={ref}>{null}</Fragment>;
    };

    renderer.render(<App />);
    expect(ref.get()).toEqual([]);
  });

  it('should track nested fragments with separate refs', () => {
    const renderer = getActiveRenderer();
    const outerRef = Cell.source<HTMLElement[] | null>(null);
    const innerRef = Cell.source<HTMLElement[] | null>(null);
    const App = () => {
      return (
        <Fragment ref={outerRef}>
          <div>outer</div>
          <Fragment ref={innerRef}>
            <span>inner</span>
          </Fragment>
          <p>tail</p>
        </Fragment>
      );
    };

    renderer.render(<App />);
    expect(outerRef.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'outer',
      'inner',
      'tail',
    ]);
    expect(innerRef.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'inner',
    ]);
  });

  it('should track component output inside a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const Item = () => {
      return <li>item</li>;
    };
    const App = () => {
      return (
        <Fragment ref={ref}>
          <Item />
          <Item />
        </Fragment>
      );
    };

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(2);
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      'item',
      'item',
    ]);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should flatten array children into the ref', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = [<div>1</div>, <div>2</div>, <div>3</div>];
    const App = () => {
      return <Fragment ref={ref}>{items}</Fragment>;
    };

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(3);
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('should re-evaluate plain conditional children on re-render', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const App = ({ show }: { show: boolean }) => {
      return (
        <Fragment ref={ref}>{show ? <div>yes</div> : <span>no</span>}</Fragment>
      );
    };

    renderer.render(<App show={true} />);
    const first = ref.get();
    expect(first).toHaveLength(1);
    expect(textOf(first![0] as NodeLike)).toBe('yes');

    renderer.render(<App show={false} />);
    const second = ref.get();
    expect(second).toHaveLength(1);
    expect(textOf(second![0] as NodeLike)).toBe('no');
  });

  it('should preserve document order across mixed content', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const Item = () => {
      return <em>e</em>;
    };
    const App = () => {
      return (
        <Fragment ref={ref}>
          <div>a</div>
          {[<span>b</span>, <span>c</span>]}
          {'text'}
          <Item />
          <Fragment>
            <p>d</p>
          </Fragment>
        </Fragment>
      );
    };

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      'a',
      'b',
      'c',
      'text',
      'e',
      'd',
    ]);
  });
};

describe('Simple Fragment Refs', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
