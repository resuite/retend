import { describe, it, expect, afterAll } from 'vitest';
import { useSetupEffect, If, Cell, For } from 'retend';
import { resetGlobalContext } from 'retend/context';
import { browserSetup, getTextContent } from '../../setup.ts';

describe('nested useSetupEffect', () => {
  browserSetup();

  afterAll(() => {
    resetGlobalContext();
  });

  it('should handle nested If components', () => {
    const setupLogs: string[] = [];
    const cleanupLogs: string[] = [];

    const showOuter = Cell.source(false);
    const showInner = Cell.source(false);

    const Inner = () => {
      useSetupEffect(() => {
        setupLogs.push('inner');
        return () => cleanupLogs.push('inner');
      });
      return <div>Inner</div>;
    };

    const Outer = () => {
      useSetupEffect(() => {
        setupLogs.push('outer');
        return () => cleanupLogs.push('outer');
      });
      return <div>{If(showInner, Inner)}</div>;
    };

    const App = () => <div>{If(showOuter, Outer)}</div>;

    App();
    expect(setupLogs).toEqual([]);
    expect(cleanupLogs).toEqual([]);

    showOuter.set(true);
    expect(setupLogs).toEqual(['outer']);
    expect(cleanupLogs).toEqual([]);
    setupLogs.length = 0;

    showInner.set(true);
    expect(setupLogs).toEqual(['inner']);
    expect(cleanupLogs).toEqual([]);
    setupLogs.length = 0;

    showInner.set(false);
    expect(setupLogs).toEqual([]);
    expect(cleanupLogs).toEqual(['inner']);
    cleanupLogs.length = 0;

    showOuter.set(false);
    expect(setupLogs).toEqual([]);
    expect(cleanupLogs).toEqual(['outer']);
  });

  it('should handle nested For components', () => {
    const outerList = Cell.source<number[]>([]);
    const innerList = Cell.source<number[]>([]);
    const setupLogs: string[] = [];
    const cleanupLogs: string[] = [];

    const Inner = () => {
      useSetupEffect(() => {
        setupLogs.push('inner');

        return () => cleanupLogs.push('inner');
      });

      return <div>Inner</div>;
    };

    const Outer = () => {
      useSetupEffect(() => {
        setupLogs.push('outer');

        return () => cleanupLogs.push('outer');
      });

      return <div>Outer[{For(innerList, Inner)}]</div>;
    };

    const App = () => {
      return <div>{For(outerList, Outer)}</div>;
    };

    const result = App() as HTMLElement;
    expect(getTextContent(result)).toEqual('');
    outerList.set([1, 2, 3]);
    expect(getTextContent(result)).toEqual('Outer[]Outer[]Outer[]');
    expect(setupLogs).toEqual(['outer', 'outer', 'outer']);

    innerList.set([1, 2, 3]);
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
