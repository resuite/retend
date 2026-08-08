import { Await, Cell, For, Fragment, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, textOf, vDomSetup, type NodeLike } from '../setup.tsx';

const pendingText = () =>
  Cell.derivedAsync(() => new Promise<string>(() => undefined));

const runTests = () => {
  it('should expose the initial Await fallback', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const pending = pendingText();
    const App = () => (
      <Fragment ref={ref}>
        <Await fallback={<span>Loading</span>}>
          <div>{pending}</div>
        </Await>
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(textOf(nodes![0] as NodeLike)).toBe('Loading');
  });

  it('should collect multiple nodes from an Await fallback fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const pending = pendingText();
    const App = () => (
      <Fragment ref={ref}>
        <Await
          fallback={
            <>
              <span>A</span>
              <span>B</span>
            </>
          }
        >
          <div>{pending}</div>
        </Await>
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'A',
      'B',
    ]);
  });

  it('should expose text from an Await fallback', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<unknown[] | null>(null);
    const pending = pendingText();
    const App = () => (
      <Fragment ref={ref}>
        <Await fallback="Loading text">
          <div>{pending}</div>
        </Await>
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect((nodes![0] as Node).nodeType).toBe(renderer.host.Node.TEXT_NODE);
    expect((nodes![0] as Node).textContent).toBe('Loading text');
  });

  it('should keep document order across mixed Await fallback content', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<unknown[] | null>(null);
    const pending = pendingText();
    const App = () => (
      <Fragment ref={ref}>
        <div>head</div>
        <Await
          fallback={
            <>
              <b>A</b>
              {'-'}
              <i>B</i>
            </>
          }
        >
          <div>{pending}</div>
        </Await>
        <div>tail</div>
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'head',
      'A',
      '-',
      'B',
      'tail',
    ]);
  });

  it('should unwrap a For rendered in the initial Await fallback', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const pending = pendingText();
    const items = Cell.source(['a', 'b']);
    const App = () => (
      <Fragment ref={ref}>
        <Await
          fallback={For(items, (item) => (
            <li>{item}</li>
          ))}
        >
          <div>{pending}</div>
        </Await>
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'a',
      'b',
    ]);
  });
};

describe('Await Block Fragment Refs', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
