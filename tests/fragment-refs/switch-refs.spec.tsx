import type { JSX } from 'retend/jsx-runtime';

import { Cell, Fragment, Switch, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, textOf, vDomSetup, type NodeLike } from '../setup.tsx';

const runTests = () => {
  it('should expose the selected case of a reactive Switch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const value = Cell.source<'a' | 'b'>('b');
    const App = () => (
      <Fragment ref={ref}>
        {Switch(value, {
          a: () => <b>A</b>,
          b: () => <i>B</i>,
        })}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('B');
  });

  it('should expose the default case of a reactive Switch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const value = Cell.source<'a' | 'missing'>('missing');
    const App = () => (
      <Fragment ref={ref}>
        {Switch(
          value,
          {
            a: () => <b>A</b>,
          },
          () => (
            <i>default</i>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(textOf(nodes![0] as NodeLike)).toBe('default');
  });

  it('should collect multiple nodes from a Switch case returning a fragment', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const value = Cell.source<'a'>('a');
    const App = () => (
      <Fragment ref={ref}>
        {Switch(value, {
          a: () => (
            <>
              <span>1</span>
              <span>2</span>
            </>
          ),
        })}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes!.map((node) => textOf(node as NodeLike))).toEqual(['1', '2']);
  });

  it('should expose text returned by a reactive Switch case', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<unknown[] | null>(null);
    const value = Cell.source<'text'>('text');
    const App = () => (
      <Fragment ref={ref}>
        {Switch(value, {
          text: () => 'plain text',
        })}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect((nodes![0] as Node).nodeType).toBe(renderer.host.Node.TEXT_NODE);
    expect((nodes![0] as Node).textContent).toBe('plain text');
  });

  it('should unwrap a nested reactive Switch through a component', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const outer = Cell.source<'inner'>('inner');
    const inner = Cell.source<'a' | 'b'>('b');
    const Inner = () =>
      Switch(inner, {
        a: () => <b>A</b>,
        b: () => <i>B</i>,
      });
    const App = () => (
      <Fragment ref={ref}>
        {Switch(outer, {
          inner: () => <Inner />,
        })}
      </Fragment>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(textOf(nodes![0] as NodeLike)).toBe('B');
  });

  it('should update the ref when a reactive Switch changes cases', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const value = Cell.source<'a' | 'b'>('a');
    const App = () => (
      <Fragment ref={ref}>
        {Switch(value, {
          a: () => <b>A</b>,
          b: () => <i>B</i>,
        })}
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('A');

    value.set('b');
    expect(ref.get()).toHaveLength(1);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('B');

    value.set('a');
    expect(textOf(ref.get()![0] as NodeLike)).toBe('A');
  });

  it('should update the ref when a reactive Switch moves to the default case', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const value = Cell.source<'a' | 'missing'>('a');
    const App = () => (
      <Fragment ref={ref}>
        {Switch(
          value,
          {
            a: () => <b>A</b>,
          },
          () => (
            <i>default</i>
          )
        )}
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('A');

    value.set('missing');
    expect(ref.get()).toHaveLength(1);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('default');

    value.set('a');
    expect(textOf(ref.get()![0] as NodeLike)).toBe('A');
  });

  it('should expose a Switch forwarded through props.children into a Fragment ref', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const value = Cell.source<'a' | 'b'>('b');
    const Panel = (props: { children: JSX.Children }) => (
      <Fragment ref={ref}>{props.children}</Fragment>
    );
    const App = () => (
      <Panel>
        {Switch(value, {
          a: () => <b>A</b>,
          b: () => <i>B</i>,
        })}
      </Panel>
    );

    renderer.render(<App />);
    const nodes = ref.get();
    expect(nodes).toHaveLength(1);
    expect(nodes![0]).toBeInstanceOf(renderer.host.HTMLElement);
    expect(textOf(nodes![0] as NodeLike)).toBe('B');
  });

  it('should update the ref when a Switch forwarded through props.children changes cases', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const value = Cell.source<'a' | 'b'>('a');
    const Panel = (props: { children: JSX.Children }) => (
      <Fragment ref={ref}>{props.children}</Fragment>
    );
    const App = () => (
      <Panel>
        {Switch(value, {
          a: () => <b>A</b>,
          b: () => <i>B</i>,
        })}
      </Panel>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('A');

    value.set('b');
    expect(ref.get()).toHaveLength(1);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('B');

    value.set('a');
    expect(textOf(ref.get()![0] as NodeLike)).toBe('A');
  });
};

describe('Switch Block Fragment Refs', () => {
  describe('Browser', () => {
    browserSetup();
    runTests();
  });

  describe('VDom', () => {
    vDomSetup();
    runTests();
  });
});
