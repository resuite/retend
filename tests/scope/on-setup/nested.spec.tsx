import {
  Cell,
  For,
  If,
  getActiveRenderer,
  onSetup,
  runPendingSetupEffects,
} from 'retend';
import { describe, expect, it } from 'vitest';

import { browserSetup, getTextContent, timeout } from '../../setup.tsx';

describe('nested onSetup', () => {
  browserSetup();

  it('should handle nested If components', async () => {
    const setupLogs: string[] = [];
    const cleanupLogs: string[] = [];

    const showOuter = Cell.source(false);
    const showInner = Cell.source(false);

    const Inner = () => {
      onSetup(() => {
        setupLogs.push('inner');
        return () => cleanupLogs.push('inner');
      });
      return <div>Inner</div>;
    };

    const Outer = () => {
      onSetup(() => {
        setupLogs.push('outer');
        return () => cleanupLogs.push('outer');
      });
      return <div>{If(showInner, Inner)}</div>;
    };

    const App = () => <div>{If(showOuter, Outer)}</div>;

    const renderer = getActiveRenderer();
    const result = renderer.render(App) as HTMLElement;
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(setupLogs).toEqual([]);
    expect(cleanupLogs).toEqual([]);

    showOuter.set(true);
    await timeout();
    expect(setupLogs).toEqual(['outer']);
    expect(cleanupLogs).toEqual([]);
    setupLogs.length = 0;

    showInner.set(true);
    await timeout();
    expect(setupLogs).toEqual(['inner']);
    expect(cleanupLogs).toEqual([]);
    setupLogs.length = 0;

    showInner.set(false);
    await timeout();
    expect(setupLogs).toEqual([]);
    expect(cleanupLogs).toEqual(['inner']);
    cleanupLogs.length = 0;

    showOuter.set(false);
    await timeout();
    expect(setupLogs).toEqual([]);
    expect(cleanupLogs).toEqual(['outer']);
  });

  it('should handle nested For components', async () => {
    const outerList = Cell.source<number[]>([]);
    const innerList = Cell.source<number[]>([]);
    const setupLogs: string[] = [];
    const cleanupLogs: string[] = [];

    const Inner = () => {
      onSetup(() => {
        setupLogs.push('inner');

        return () => cleanupLogs.push('inner');
      });

      return <div>Inner</div>;
    };

    const Outer = () => {
      onSetup(() => {
        setupLogs.push('outer');

        return () => cleanupLogs.push('outer');
      });

      return <div>Outer[{For(innerList, Inner)}]</div>;
    };

    const App = () => {
      return <div>{For(outerList, Outer)}</div>;
    };

    const renderer = getActiveRenderer();
    const result = renderer.render(App) as HTMLElement;
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(getTextContent(result)).toEqual('');
    outerList.set([1, 2, 3]);
    await timeout();
    expect(getTextContent(result)).toEqual('Outer[]Outer[]Outer[]');
    expect(setupLogs).toEqual(['outer', 'outer', 'outer']);

    innerList.set([1, 2, 3]);
    await timeout();
    expect(getTextContent(result)).toEqual(
      'Outer[InnerInnerInner]Outer[InnerInnerInner]Outer[InnerInnerInner]'
    );
    expect(setupLogs).toEqual([
      'outer',
      'outer',
      'outer',
      'inner',
      'inner',
      'inner',
      'inner',
      'inner',
      'inner',
      'inner',
      'inner',
      'inner',
    ]);

    outerList.set([]);
    await timeout();
    // runs depth first.
    expect(cleanupLogs).toEqual([
      'outer',
      'inner',
      'inner',
      'inner',
      'outer',
      'inner',
      'inner',
      'inner',
      'outer',
      'inner',
      'inner',
      'inner',
    ]);
  });
});
