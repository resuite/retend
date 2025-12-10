import { describe, it, expect } from 'vitest';
import { If, For, Cell, runPendingSetupEffects } from 'retend';
import { vDomSetup, browserSetup } from '../../setup.tsx';

const runTests = () => {
  it('stops derived cells when component unmounts', async () => {
    const show = Cell.source(true);
    const source = Cell.source(0);
    let computeCount = 0;

    const Component = () => {
      const derived = Cell.derived(() => {
        computeCount++;
        return source.get() * 2;
      });
      return <div>{derived}</div>;
    };

    const App = () => <div>{If(show, Component)}</div>;
    App();
    await runPendingSetupEffects();

    const countBeforeUnmount = computeCount;
    show.set(false);

    source.set(10);
    source.set(20);

    expect(computeCount).toBe(countBeforeUnmount);
  });

  it('stops .listen callbacks when component unmounts', async () => {
    const show = Cell.source(true);
    const source = Cell.source(0);
    let listenCount = 0;

    const Component = () => {
      source.listen(() => listenCount++);
      return <div>test</div>;
    };

    const App = () => <div>{If(show, Component)}</div>;
    App();
    await runPendingSetupEffects();

    const countBeforeUnmount = listenCount;
    show.set(false);

    source.set(10);
    source.set(20);

    expect(listenCount).toBe(countBeforeUnmount);
  });

  it('stops .runAndListen callbacks when component unmounts', async () => {
    const show = Cell.source(true);
    const source = Cell.source(0);
    let runAndListenCount = 0;

    const Component = () => {
      source.runAndListen(() => runAndListenCount++);
      return <div>test</div>;
    };

    const App = () => <div>{If(show, Component)}</div>;
    App();
    await runPendingSetupEffects();

    const countBeforeUnmount = runAndListenCount;
    show.set(false);

    source.set(10);
    source.set(20);

    expect(runAndListenCount).toBe(countBeforeUnmount);
  });

  it('cleans up For loop items independently', () => {
    const items = Cell.source([1, 2, 3]);
    const listenCounts = new Map<number, number>();

    const Item = (props: { id: number }) => {
      const tracker = Cell.source(0);
      tracker.runAndListen(() => {
        listenCounts.set(props.id, (listenCounts.get(props.id) || 0) + 1);
      });
      return <div>{props.id}</div>;
    };

    const App = () => (
      <div>
        {For(items, (id) => (
          <Item id={id} />
        ))}
      </div>
    );
    App();

    items.set([1, 2]);

    const item1Before = listenCounts.get(1) || 0;
    const item2Before = listenCounts.get(2) || 0;
    const item3Before = listenCounts.get(3) || 0;

    items.set([2, 1]);

    expect(listenCounts.get(1)).toBeGreaterThan(item1Before);
    expect(listenCounts.get(2)).toBeGreaterThan(item2Before);
    expect(listenCounts.get(3)).toBe(item3Before);
  });

  it('cleans up Switch cases when switching', async () => {
    const { Switch } = await import('retend');
    const state = Cell.source<'a' | 'b'>('a');
    const source = Cell.source(0);
    let aComputes = 0;
    let bComputes = 0;

    const CaseA = () => {
      const derived = Cell.derived(() => {
        aComputes++;
        return source.get();
      });
      return <div>{derived}</div>;
    };

    const CaseB = () => {
      const derived = Cell.derived(() => {
        bComputes++;
        return source.get();
      });
      return <div>{derived}</div>;
    };

    const App = () => <div>{Switch(state, { a: CaseA, b: CaseB })}</div>;

    App();
    await runPendingSetupEffects();

    state.set('b');
    const aComputesAfterSwitch = aComputes;

    source.set(10);
    expect(aComputes).toBe(aComputesAfterSwitch);
    expect(bComputes).toBeGreaterThan(0);
  });

  it('cleans up nested components', async () => {
    const show = Cell.source(true);
    const source = Cell.source(0);
    let parentComputes = 0;
    let childComputes = 0;

    const Child = () => {
      const derived = Cell.derived(() => {
        childComputes++;
        return source.get();
      });
      return <div>{derived}</div>;
    };

    const Parent = () => {
      const derived = Cell.derived(() => {
        parentComputes++;
        return source.get();
      });
      return (
        <div>
          {derived}
          <Child />
        </div>
      );
    };

    const App = () => <div>{If(show, Parent)}</div>;
    App();
    await runPendingSetupEffects();

    const parentBefore = parentComputes;
    const childBefore = childComputes;
    show.set(false);

    source.set(10);
    expect(parentComputes).toBe(parentBefore);
    expect(childComputes).toBe(childBefore);
  });

  it('cleans up chained derived cells', async () => {
    const show = Cell.source(true);
    const source = Cell.source(1);
    let compute1 = 0;
    let compute2 = 0;
    let compute3 = 0;

    const Component = () => {
      const derived1 = Cell.derived(() => {
        compute1++;
        return source.get() * 2;
      });
      const derived2 = Cell.derived(() => {
        compute2++;
        return derived1.get() * 2;
      });
      const derived3 = Cell.derived(() => {
        compute3++;
        return derived2.get() * 2;
      });
      return <div>{derived3}</div>;
    };

    const App = () => <div>{If(show, Component)}</div>;
    App();
    await runPendingSetupEffects();

    const c1Before = compute1;
    const c2Before = compute2;
    const c3Before = compute3;
    show.set(false);

    source.set(10);
    expect(compute1).toBe(c1Before);
    expect(compute2).toBe(c2Before);
    expect(compute3).toBe(c3Before);
  });

  it('cleans up multiple listeners on same cell', async () => {
    const show = Cell.source(true);
    const source = Cell.source(0);
    let listen1 = 0;
    let listen2 = 0;
    let listen3 = 0;

    const Component = () => {
      source.listen(() => listen1++);
      source.listen(() => listen2++);
      source.runAndListen(() => listen3++);
      return <div>test</div>;
    };

    const App = () => <div>{If(show, Component)}</div>;
    App();
    await runPendingSetupEffects();

    const l1Before = listen1;
    const l2Before = listen2;
    const l3Before = listen3;
    show.set(false);

    source.set(10);
    expect(listen1).toBe(l1Before);
    expect(listen2).toBe(l2Before);
    expect(listen3).toBe(l3Before);
  });

  it('cleans up scope context derived cells', async () => {
    const { createScope, useScopeContext } = await import('retend');
    const show = Cell.source(true);
    const TestScope = createScope<ReturnType<typeof Cell.source<number>>>();
    const scopeCell = Cell.source(0);
    let computes = 0;

    const Consumer = () => {
      const cell = useScopeContext(TestScope);
      const derived = Cell.derived(() => {
        computes++;
        return cell.get();
      });
      return <div>{derived}</div>;
    };

    const App = () => (
      <div>
        {If(show, () => (
          <TestScope.Provider value={scopeCell}>
            {() => <Consumer />}
          </TestScope.Provider>
        ))}
      </div>
    );

    App();
    await runPendingSetupEffects();

    const computesBefore = computes;
    show.set(false);

    scopeCell.set(10);
    expect(computes).toBe(computesBefore);
  });

  it('isolates cleanup between independent components', async () => {
    const show1 = Cell.source(true);
    const show2 = Cell.source(true);
    const source = Cell.source(0);
    let computes1 = 0;
    let computes2 = 0;

    const Component1 = () => {
      const derived = Cell.derived(() => {
        computes1++;
        return source.get();
      });
      return <div>{derived}</div>;
    };

    const Component2 = () => {
      const derived = Cell.derived(() => {
        computes2++;
        return source.get();
      });
      return <div>{derived}</div>;
    };

    const App = () => (
      <div>
        {If(show1, Component1)}
        {If(show2, Component2)}
      </div>
    );

    App();
    await runPendingSetupEffects();

    show1.set(false);
    const c1After = computes1;
    const c2Before = computes2;

    source.set(10);
    expect(computes1).toBe(c1After);
    expect(computes2).toBeGreaterThan(c2Before);
  });
};

describe('localContext cleanup', () => {
  describe('VDom', () => {
    vDomSetup();
    runTests();
  });

  describe('Browser', () => {
    browserSetup();
    runTests();
  });
});
