import {
  Await,
  Cell,
  For,
  Fragment,
  If,
  Switch,
  createUnique,
  getActiveRenderer,
} from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, textOf, vDomSetup, type NodeLike } from '../setup.tsx';

const runTests = () => {
  it('should expose the content of a unique component inside a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const UniqueContent = createUnique(() => <div>unique</div>);
    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent />
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('unique');
  });

  it('should keep unique siblings with distinct ids in document order', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const UniqueContent = createUnique((props: Cell<{ label: string }>) => (
      <div>{props.get().label}</div>
    ));
    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent id="a" label="A" />
        <UniqueContent id="b" label="B" />
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual(['A', 'B']);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should expose the active branch of an If inside a unique component', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const UniqueContent = createUnique(() =>
      If(
        condition,
        () => <div>yes</div>,
        () => <div>no</div>
      )
    );
    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent id="x" />
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('yes');
  });

  it('should expose the mapped items of a For inside a unique component', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source(['a', 'b', 'c']);
    const UniqueContent = createUnique(() =>
      For(items, (item) => <li>{item}</li>)
    );
    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent id="x" />
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

  it('should expose a unique component rendered inside an If branch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const UniqueContent = createUnique(() => <div>U</div>);
    const App = () => (
      <Fragment ref={ref}>
        {If(condition, () => (
          <UniqueContent id="x" />
        ))}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('U');
  });

  it('should collect multiple nodes when a unique component returns a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const UniqueContent = createUnique(() => (
      <>
        <span>1</span>
        <span>2</span>
      </>
    ));
    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent id="x" />
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual(['1', '2']);
    for (const node of nodes!) {
      expect(node).toBeInstanceOf(renderer.host.HTMLElement);
    }
  });

  it('should re-expose the unique content when the parent re-renders', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const UniqueContent = createUnique(() => <div>U</div>);
    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent id="x" />
      </Fragment>
    );

    renderer.render(<App />);
    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('U');
  });

  it('should not duplicate the content when the same unique id renders twice', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const UniqueContent = createUnique(() => <div>U</div>);
    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent id="x" />
        <UniqueContent id="x" />
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('U');
  });

  it('should track an If created inside Unique before the Unique enters a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);
    const UniqueContent = createUnique(() =>
      If(
        condition,
        () => <div>yes</div>,
        () => <div>no</div>
      )
    );
    const App = () => (
      <>
        <UniqueContent id="x" />
        <Fragment ref={ref}>
          <UniqueContent id="x" />
        </Fragment>
      </>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(textOf(nodes![0] as NodeLike)).toBe('yes');
  });

  it('should track a For created inside Unique before the Unique enters a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const items = Cell.source(['a', 'b']);
    const UniqueContent = createUnique(() =>
      For(items, (item) => <li>{item}</li>)
    );
    const App = () => (
      <>
        <UniqueContent id="x" />
        <Fragment ref={ref}>
          <UniqueContent id="x" />
        </Fragment>
      </>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'a',
      'b',
    ]);
  });

  it('should track a Switch created inside Unique before the Unique enters a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const value = Cell.source<'a' | 'b'>('b');
    const UniqueContent = createUnique(() =>
      Switch(value, {
        a: () => <b>A</b>,
        b: () => <i>B</i>,
      })
    );
    const App = () => (
      <>
        <UniqueContent id="x" />
        <Fragment ref={ref}>
          <UniqueContent id="x" />
        </Fragment>
      </>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(textOf(nodes![0] as NodeLike)).toBe('B');
  });

  it('should track an Await fallback created inside Unique before the Unique enters a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const pending = Cell.derivedAsync(
      () => new Promise<string>(() => undefined)
    );
    const UniqueContent = createUnique(() => (
      <Await fallback={<span>Loading</span>}>
        <div>{pending}</div>
      </Await>
    ));
    const App = () => (
      <>
        <UniqueContent id="x" />
        <Fragment ref={ref}>
          <UniqueContent id="x" />
        </Fragment>
      </>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(textOf(nodes![0] as NodeLike)).toBe('Loading');
  });

  it('should track nested reactive groups created inside Unique before it enters a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const visible = Cell.source(true);
    const items = Cell.source(['a', 'b']);
    const UniqueContent = createUnique(() =>
      If(visible, () => For(items, (item) => <li>{item}</li>))
    );
    const App = () => (
      <>
        <UniqueContent id="x" />
        <Fragment ref={ref}>
          <UniqueContent id="x" />
        </Fragment>
      </>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'a',
      'b',
    ]);
  });
};

describe('Unique Block Fragment Refs', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
