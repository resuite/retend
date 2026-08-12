import type { JSX } from 'retend/jsx-runtime';

import { Cell, For, Fragment, If, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, textOf, vDomSetup, type NodeLike } from '../setup.tsx';

const runTests = () => {
  it('should expose static For items in document order alongside siblings', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = ['a', 'b', 'c'];
    const App = () => (
      <Fragment ref={ref}>
        <div>head</div>
        {For(items, (item) => (
          <li>{item}</li>
        ))}
        <div>tail</div>
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      'head',
      'a',
      'b',
      'c',
      'tail',
    ]);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should expose the items of a reactive For in order', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source(['a', 'b', 'c']);
    const App = () => (
      <Fragment ref={ref}>
        {For(items, (item) => (
          <li>{item}</li>
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

  it('should contribute nothing for an empty reactive For', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source<string[]>([]);
    const App = () => (
      <Fragment ref={ref}>
        {For(items, (item) => (
          <li>{item}</li>
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()).toEqual([]);
  });

  it('should expose For items keyed by a property', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);
    const App = () => (
      <Fragment ref={ref}>
        {For(
          items,
          (item) => (
            <li>{item.label}</li>
          ),
          { key: 'id' }
        )}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual(['A', 'B']);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should flatten fragment-returning For items in order', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source(['a', 'b']);
    const App = () => (
      <Fragment ref={ref}>
        {For(items, (item) => (
          <>
            <span>{item}</span>
            <span>-</span>
          </>
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      'a',
      '-',
      'b',
      '-',
    ]);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should expose only the active items when For items contain an If', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source([
      { name: 'a', active: true },
      { name: 'b', active: false },
      { name: 'c', active: true },
    ]);
    const App = () => (
      <Fragment ref={ref}>
        {For(items, (item) => If(item.active, () => <li>{item.name}</li>))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual(['a', 'c']);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should track text nodes returned by For items', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<unknown[] | null>(null);
    const items = Cell.source(['x', 'y']);
    const App = () => (
      <Fragment ref={ref}>{For(items, (item) => item)}</Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(2);
    for (const node of nodes!) {
      expect(node).not.toBeInstanceOf(renderer.host.HTMLElement);
      expect((node as Node).nodeType).toBe(renderer.host.Node.TEXT_NODE);
    }
    expect((nodes![0] as Node).textContent).toBe('x');
    expect((nodes![1] as Node).textContent).toBe('y');
  });

  it('should expose component output per For item', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source(['x', 'y']);
    const Item = ({ value }: { value: string }) => <li>{value}</li>;
    const App = () => (
      <Fragment ref={ref}>
        {For(items, (item) => (
          <Item value={item} />
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual(['x', 'y']);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should unwrap nested For groups down to the items', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source([
      { name: 'a', children: Cell.source(['1', '2']) },
      { name: 'b', children: Cell.source(['3']) },
    ]);
    const App = () => (
      <Fragment ref={ref}>
        {For(items, (item) =>
          For(item.children, (child) => (
            <li>
              {item.name}
              {child}
            </li>
          ))
        )}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual([
      'a1',
      'a2',
      'b3',
    ]);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should update the ref when a reactive For replaces its items', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
    const App = () => (
      <Fragment ref={ref}>
        {For(
          items,
          (item) => (
            <li>{item.name}</li>
          ),
          { key: 'id' }
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'A',
      'B',
      'C',
    ]);

    items.set([
      { id: 'x', name: 'X' },
      { id: 'y', name: 'Y' },
      { id: 'z', name: 'Z' },
    ]);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'X',
      'Y',
      'Z',
    ]);

    items.set([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('should update the ref to the new document order when a keyed reactive For is reordered', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
    const App = () => (
      <Fragment ref={ref}>
        {For(
          items,
          (item) => (
            <li>{item.name}</li>
          ),
          { key: 'id' }
        )}
      </Fragment>
    );

    renderer.render(<App />);
    const first = ref.get()!;
    expect(first.map((node) => textOf(node as NodeLike))).toEqual([
      'A',
      'B',
      'C',
    ]);

    items.set([
      { id: 'c', name: 'C' },
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    const second = ref.get()!;
    expect(second.map((node) => textOf(node as NodeLike))).toEqual([
      'C',
      'A',
      'B',
    ]);
    // Keyed For moves nodes rather than recreating them, so the ref keeps the
    // same node identities and only their order changes.
    expect(second[0]).toBe(first[2]);
    expect(second[1]).toBe(first[0]);
    expect(second[2]).toBe(first[1]);
  });

  it('should empty the ref when a reactive For becomes empty', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    const App = () => (
      <Fragment ref={ref}>
        {For(
          items,
          (item) => (
            <li>{item.name}</li>
          ),
          { key: 'id' }
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'A',
      'B',
    ]);

    items.set([]);
    expect(ref.get()).toEqual([]);

    items.set([{ id: 'a', name: 'A' }]);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual(['A']);
  });

  it('should expose a For forwarded through props.children into a Fragment ref', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    const List = (props: { children: JSX.Children }) => (
      <Fragment ref={ref}>{props.children}</Fragment>
    );
    const App = () => (
      <List>
        {For(
          items,
          (item) => (
            <li>{item.name}</li>
          ),
          { key: 'id' }
        )}
      </List>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual(['A', 'B']);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should update the ref when a For forwarded through props.children is reordered', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    const List = (props: { children: JSX.Children }) => (
      <Fragment ref={ref}>{props.children}</Fragment>
    );
    const App = () => (
      <List>
        {For(
          items,
          (item) => (
            <li>{item.name}</li>
          ),
          { key: 'id' }
        )}
      </List>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'A',
      'B',
    ]);

    items.set([
      { id: 'b', name: 'B' },
      { id: 'a', name: 'A' },
    ]);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'B',
      'A',
    ]);

    items.set([]);
    expect(ref.get()).toEqual([]);
  });
};

describe('For Block Fragment Refs', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
