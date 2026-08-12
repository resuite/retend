import { Await, Cell, For, Fragment, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';

import {
  browserSetup,
  textOf,
  timeout,
  vDomSetup,
  type NodeLike,
} from '../setup.tsx';

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

  it('should update the ref when Await finishes rendering its content', async () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    let resolvePending!: (value: string) => void;
    const pending = Cell.derivedAsync(
      () =>
        new Promise<string>((resolve) => {
          resolvePending = resolve;
        })
    );
    const App = () => (
      <Fragment ref={ref}>
        <Await fallback={<span>Loading</span>}>
          <div>{pending}</div>
        </Await>
      </Fragment>
    );

    renderer.render(<App />);
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'Loading',
    ]);

    resolvePending('Ready');
    await timeout();

    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'Ready',
    ]);
  });

  it('should update the ref when a nested Await finishes rendering', async () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    let resolveInner!: (value: string) => void;
    const inner = Cell.derivedAsync(
      () =>
        new Promise<string>((resolve) => {
          resolveInner = resolve;
        })
    );
    const App = () => (
      <Fragment ref={ref}>
        <Await fallback={<span>OuterLoading</span>}>
          <Await fallback={<span>InnerLoading</span>}>
            <div>{inner}</div>
          </Await>
        </Await>
      </Fragment>
    );

    renderer.render(<App />);
    // The outer Await has no async dependency of its own, so it resolves
    // independently and reveals the inner Await's fallback.
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'OuterLoading',
    ]);

    await timeout();
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'InnerLoading',
    ]);

    resolveInner('Ready');
    await timeout();
    expect(ref.get()!.map((node) => textOf(node as NodeLike))).toEqual([
      'Ready',
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
