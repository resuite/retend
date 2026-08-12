import { Cell, Fragment, If, createUnique, getActiveRenderer } from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, textOf, vDomSetup, type NodeLike } from '../setup.tsx';

const runTests = () => {
  it('should update the enclosing fragment ref when an If inside a Unique switches', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);

    const UniqueContent = createUnique(() => {
      return If(
        condition,
        () => <div>yes</div>,
        () => <span>no</span>
      );
    });

    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent />
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');

    condition.set(false);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('no');

    condition.set(true);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');
  });

  it('should empty the enclosing fragment ref when an If inside a Unique turns falsy without an else branch', () => {
    const renderer = getActiveRenderer();
    const ref = Cell.source<HTMLElement[] | null>(null);
    const condition = Cell.source(true);

    const UniqueContent = createUnique(() => {
      return If(condition, () => <div>yes</div>);
    });

    const App = () => (
      <Fragment ref={ref}>
        <UniqueContent />
      </Fragment>
    );

    renderer.render(<App />);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');

    condition.set(false);
    expect(ref.get()).toEqual([]);

    condition.set(true);
    expect(textOf(ref.get()![0] as NodeLike)).toBe('yes');
  });

  it('should expose a Unique moved between two fragments in each ref', () => {
    const renderer = getActiveRenderer();
    const refFirst = Cell.source<HTMLElement[] | null>(null);
    const refSecond = Cell.source<HTMLElement[] | null>(null);
    const showSecond = Cell.source(false);

    const UniqueContent = createUnique(() => <div>Unique Data</div>);

    const App = () => (
      <>
        <Fragment ref={refFirst}>
          {If(
            showSecond,
            () => null,
            () => (
              <UniqueContent />
            )
          )}
        </Fragment>
        <Fragment ref={refSecond}>
          {If(
            showSecond,
            () => (
              <UniqueContent />
            ),
            () => null
          )}
        </Fragment>
      </>
    );

    renderer.render(<App />);
    expect(textOf(refFirst.get()![0] as NodeLike)).toBe('Unique Data');
    expect(refSecond.get()).toEqual([]);

    showSecond.set(true);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('Unique Data');
    expect(refFirst.get()).toEqual([]);
  });

  it('should empty the previous ref when a Unique moves out of a static fragment', () => {
    const renderer = getActiveRenderer();
    const refFirst = Cell.source<HTMLElement[] | null>(null);
    const refSecond = Cell.source<HTMLElement[] | null>(null);
    const showSecond = Cell.source(true);

    const UniqueContent = createUnique(() => <div>Unique Data</div>);

    const App = () => (
      <>
        <Fragment ref={refFirst}>
          <UniqueContent />
        </Fragment>
        <Fragment ref={refSecond}>
          {If(
            showSecond,
            () => (
              <UniqueContent />
            ),
            () => null
          )}
        </Fragment>
      </>
    );

    renderer.render(<App />);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('Unique Data');
    expect(refFirst.get()).toEqual([]);
  });

  it('should restore the fragment ref when the latest unique instance is removed', () => {
    const renderer = getActiveRenderer();
    const refFirst = Cell.source<HTMLElement[] | null>(null);
    const refSecond = Cell.source<HTMLElement[] | null>(null);
    const showSecond = Cell.source(true);

    const UniqueContent = createUnique(() => <div>Unique Data</div>);

    const App = () => (
      <>
        <Fragment ref={refFirst}>
          {If(
            showSecond,
            () => null,
            () => (
              <UniqueContent />
            )
          )}
        </Fragment>
        <Fragment ref={refSecond}>
          {If(
            showSecond,
            () => (
              <UniqueContent />
            ),
            () => null
          )}
        </Fragment>
      </>
    );

    renderer.render(<App />);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('Unique Data');
    expect(refFirst.get()).toEqual([]);

    showSecond.set(false);
    expect(textOf(refFirst.get()![0] as NodeLike)).toBe('Unique Data');
    expect(refSecond.get()).toEqual([]);
  });

  it('should keep an If inside a Unique reactive after the Unique moves between locations', () => {
    const renderer = getActiveRenderer();
    const refFirst = Cell.source<HTMLElement[] | null>(null);
    const refSecond = Cell.source<HTMLElement[] | null>(null);
    const showSecond = Cell.source(false);
    const condition = Cell.source(true);

    const UniqueContent = createUnique(() => {
      return If(
        condition,
        () => <div>yes</div>,
        () => <span>no</span>
      );
    });

    const App = () => (
      <>
        <Fragment ref={refFirst}>
          {If(
            showSecond,
            () => null,
            () => (
              <UniqueContent />
            )
          )}
        </Fragment>
        <Fragment ref={refSecond}>
          {If(
            showSecond,
            () => (
              <UniqueContent />
            ),
            () => null
          )}
        </Fragment>
      </>
    );

    renderer.render(<App />);
    expect(textOf(refFirst.get()![0] as NodeLike)).toBe('yes');

    showSecond.set(true);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('yes');
    expect(refFirst.get()).toEqual([]);

    condition.set(false);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('no');
    expect(refFirst.get()).toEqual([]);

    condition.set(true);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('yes');
  });

  it('should propagate a nested ref change to the current enclosing fragment after a move', () => {
    const renderer = getActiveRenderer();
    const refFirst = Cell.source<HTMLElement[] | null>(null);
    const refSecond = Cell.source<HTMLElement[] | null>(null);
    const innerRef = Cell.source<HTMLElement[] | null>(null);
    const showSecond = Cell.source(false);
    const condition = Cell.source(true);

    const UniqueContent = createUnique(() => {
      return (
        <Fragment ref={innerRef}>
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
    });

    const App = () => (
      <>
        <Fragment ref={refFirst}>
          {If(
            showSecond,
            () => null,
            () => (
              <UniqueContent />
            )
          )}
        </Fragment>
        <Fragment ref={refSecond}>
          {If(
            showSecond,
            () => (
              <UniqueContent />
            ),
            () => null
          )}
        </Fragment>
      </>
    );

    renderer.render(<App />);
    expect(textOf(refFirst.get()![0] as NodeLike)).toBe('yes');
    expect(refSecond.get()).toEqual([]);

    showSecond.set(true);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('yes');
    expect(refFirst.get()).toEqual([]);

    condition.set(false);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('no');
    expect(refFirst.get()).toEqual([]);
    expect(textOf(innerRef.get()![0] as NodeLike)).toBe('no');
  });

  it('should keep listeners and derived cells inside a Unique alive after a move', () => {
    const renderer = getActiveRenderer();
    const refFirst = Cell.source<HTMLElement[] | null>(null);
    const refSecond = Cell.source<HTMLElement[] | null>(null);
    const showSecond = Cell.source(false);
    const count = Cell.source(1);
    let listenerCalls = 0;

    const UniqueContent = createUnique(() => {
      count.listen(() => {
        listenerCalls += 1;
      });
      const doubled = Cell.derived(() => count.get() * 2);
      return <div>{doubled}</div>;
    });

    const App = () => (
      <>
        <Fragment ref={refFirst}>
          {If(
            showSecond,
            () => null,
            () => (
              <UniqueContent />
            )
          )}
        </Fragment>
        <Fragment ref={refSecond}>
          {If(
            showSecond,
            () => (
              <UniqueContent />
            ),
            () => null
          )}
        </Fragment>
      </>
    );

    renderer.render(<App />);
    expect(textOf(refFirst.get()![0] as NodeLike)).toBe('2');

    showSecond.set(true);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('2');
    expect(refFirst.get()).toEqual([]);

    count.set(3);
    expect(listenerCalls).toBe(1);
    expect(textOf(refSecond.get()![0] as NodeLike)).toBe('6');
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
