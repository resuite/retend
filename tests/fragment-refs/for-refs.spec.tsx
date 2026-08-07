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
