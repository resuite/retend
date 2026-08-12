import type { JSX } from 'retend/jsx-runtime';

import { Cell, For, Fragment, If, Switch, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, textOf, vDomSetup, type NodeLike } from '../setup.tsx';

const runTests = () => {
  it('should expose the rendered branch of a reactive If (truthy)', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(
          condition,
          () => (
            <div>yes</div>
          ),
          () => (
            <span>no</span>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('yes');
  });

  it('should expose the else branch of a reactive If (falsy)', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(false);
    const App = () => (
      <Fragment ref={ref}>
        {If(
          condition,
          () => (
            <div>yes</div>
          ),
          () => (
            <span>no</span>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('no');
  });

  it('should contribute nothing for a falsy reactive If without an else branch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(false);
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, () => (
          <div>yes</div>
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()).toEqual([]);
  });

  it('should expose the active branch of the object form of If', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, {
          true: () => <b>yes</b>,
          false: () => <i>no</i>,
        })}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('yes');
  });

  it('should unwrap nested Ifs down to the innermost branch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const outer = Cell.source(true);
    const inner = Cell.source(false);
    const App = () => (
      <Fragment ref={ref}>
        {If(
          outer,
          () =>
            If(
              inner,
              () => <b>both</b>,
              () => <i>outer only</i>
            ),
          () => (
            <span>neither</span>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('outer only');
  });

  it('should collect multiple nodes from an If branch returning a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, () => (
          <>
            <b>1</b>
            <b>2</b>
          </>
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual(['1', '2']);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should keep document order across several reactive Ifs and static siblings', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const a = Cell.source(true);
    const b = Cell.source(false);
    const App = () => (
      <Fragment ref={ref}>
        <div>head</div>
        {If(a, () => (
          <b>one</b>
        ))}
        {If(
          b,
          () => (
            <i>two</i>
          ),
          () => (
            <u>two-fallback</u>
          )
        )}
        <div>tail</div>
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      'head',
      'one',
      'two-fallback',
      'tail',
    ]);
  });

  it('should track text nodes rendered by an If branch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<unknown[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>{If(condition, () => 'plain text')}</Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).not.toBeInstanceOf(renderer.host.HTMLElement);
    expect((nodes![0] as Node).nodeType).toBe(renderer.host.Node.TEXT_NODE);
    expect((nodes![0] as Node).textContent).toBe('plain text');
  });

  it('should forward through a referenced fragment nested inside an If branch', () => {
    const renderer = getActiveRenderer();
    const outerRef = Cell.source<HTMLElement[] | null>(null);
    const innerRef = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={outerRef}>
        {If(condition, () => (
          <Fragment ref={innerRef}>
            <div>inner</div>
          </Fragment>
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    expect(outerRef.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'inner',
    ]);
    expect(innerRef.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'inner',
    ]);
  });

  it('should expose the output of a component rendered by If', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const Item = () => <li>item</li>;
    const App = () => (
      <Fragment ref={ref}>
        {If(
          condition,
          () => (
            <Item />
          ),
          () => (
            <span>none</span>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('item');
  });

  it('should expose a component with children rendered by If', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const Box = (props: { children: JSX.Children }) => (
      <div>{props.children}</div>
    );
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, () => (
          <Box>
            <span>a</span>
            <span>b</span>
          </Box>
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('ab');
  });

  it('should expose the innermost branch when If renders a component that returns an If', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const inner = Cell.source(false);
    const Inner = ({ condition }: { condition: Cell<boolean> }) =>
      If(
        condition,
        () => <b>yes</b>,
        () => <i>no</i>
      );
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, () => (
          <Inner condition={inner} />
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('no');
  });

  it('should expose the matched case when If renders a component that returns a Switch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const value = Cell.source('B' as 'A' | 'B');
    const Status = () =>
      Switch(value, {
        A: () => <b>on</b>,
        B: () => <i>off</i>,
      });
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, () => (
          <Status />
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('off');
  });

  it('should expose the mapped items when If renders a component that returns a For', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const items = Cell.source(['a', 'b', 'c']);
    const List = () => For(items, (item) => <li>{item}</li>);
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, () => (
          <List />
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      'a',
      'b',
      'c',
    ]);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should update the ref when a reactive If switches branches', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(
          condition,
          () => (
            <div>yes</div>
          ),
          () => (
            <span>no</span>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual(['yes']);

    condition.set(false);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('no');
  });

  it('should keep the ref in sync as a reactive If toggles back and forth', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(
          condition,
          () => (
            <div>yes</div>
          ),
          () => (
            <span>no</span>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');

    condition.set(false);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('no');

    condition.set(true);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');
  });

  it('should empty the ref when a reactive If without an else branch turns falsy', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, () => (
          <div>yes</div>
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');

    condition.set(false);
    expect(ref.get()).toEqual([]);

    condition.set(true);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');
  });

  it('should update the ref for the object form of a reactive If', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, {
          true: () => <b>yes</b>,
          false: () => <i>no</i>,
        })}
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');

    condition.set(false);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('no');
  });

  it('should update the ref through nested Ifs when either condition changes', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const outer = Cell.source(true);
    const inner = Cell.source(false);
    const App = () => (
      <Fragment ref={ref}>
        {If(
          outer,
          () =>
            If(
              inner,
              () => <b>both</b>,
              () => <i>outer only</i>
            ),
          () => (
            <span>neither</span>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('outer only');

    inner.set(true);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('both');

    outer.set(false);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('neither');
  });

  it('should update the ref to the full set of nodes of the new branch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(
          condition,
          () => (
            <>
              <b>1</b>
              <b>2</b>
            </>
          ),
          () => (
            <u>none</u>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      '1',
      '2',
    ]);

    condition.set(false);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(textOf(nodes![0] as NodeLike)).toBe('none');

    condition.set(true);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      '1',
      '2',
    ]);
  });

  it('should keep document order in the ref across updates of several reactive Ifs', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const a = Cell.source(true);
    const b = Cell.source(false);
    const App = () => (
      <Fragment ref={ref}>
        <div>head</div>
        {If(a, () => (
          <b>one</b>
        ))}
        {If(
          b,
          () => (
            <i>two</i>
          ),
          () => (
            <u>two-fallback</u>
          )
        )}
        <div>tail</div>
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'head',
      'one',
      'two-fallback',
      'tail',
    ]);

    a.set(false);
    b.set(true);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'head',
      'two',
      'tail',
    ]);

    a.set(true);
    b.set(false);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'head',
      'one',
      'two-fallback',
      'tail',
    ]);
  });

  it('should update the ref when a reactive If swaps a component branch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const Item = () => <li>item</li>;
    const App = () => (
      <Fragment ref={ref}>
        {If(
          condition,
          () => (
            <Item />
          ),
          () => (
            <span>none</span>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('item');

    condition.set(false);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('none');

    condition.set(true);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('item');
  });

  it('should update the ref to text nodes produced by a reactive If branch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<unknown[] | null>(null);
    const condition = Cell.source(true);
    const App = () => (
      <Fragment ref={ref}>
        {If(
          condition,
          () => 'plain text',
          () => 'fallback text'
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect((ref.get()![0] as Node).textContent).toBe('plain text');

    condition.set(false);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect((nodes![0] as Node).nodeType).toBe(renderer.host.Node.TEXT_NODE);
    expect((nodes![0] as Node).textContent).toBe('fallback text');
  });

  it('should expose an If passed as props.children through a component wrapped by a Fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const Card = (props: { children: JSX.Children }) => (
      <div>{props.children}</div>
    );
    const App = () => (
      <Fragment ref={ref}>
        <Card>
          {If(
            condition,
            () => (
              <b>yes</b>
            ),
            () => (
              <i>no</i>
            )
          )}
        </Card>
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('yes');
  });

  it('should expose an If forwarded through props.children into a Fragment ref', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const Card = (props: { children: JSX.Children }) => (
      <Fragment ref={ref}>{props.children}</Fragment>
    );
    const App = () => (
      <Card>
        {If(
          condition,
          () => (
            <b>yes</b>
          ),
          () => (
            <i>no</i>
          )
        )}
      </Card>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('yes');
  });

  it('should update the ref when an If forwarded through props.children changes branches', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const Card = (props: { children: JSX.Children }) => (
      <Fragment ref={ref}>{props.children}</Fragment>
    );
    const App = () => (
      <Card>
        {If(
          condition,
          () => (
            <b>yes</b>
          ),
          () => (
            <i>no</i>
          )
        )}
      </Card>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');

    condition.set(false);
    expect(ref.get()).toHaveLength(1);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('no');

    condition.set(true);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');
  });

  it('should empty the ref when an If without an else forwarded through props.children turns falsy', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const Card = (props: { children: JSX.Children }) => (
      <Fragment ref={ref}>{props.children}</Fragment>
    );
    const App = () => (
      <Card>
        {If(condition, () => (
          <b>yes</b>
        ))}
      </Card>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');

    condition.set(false);
    expect(ref.get()).toEqual([]);

    condition.set(true);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');
  });
};

describe('If Block Fragment Refs', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
