import { describe, it, expect, vi, afterAll } from 'vitest';
import { useSetupEffect, Switch, Cell, runPendingSetupEffects } from 'retend';
import { resetGlobalContext } from 'retend/context';
import { getTextContent, browserSetup } from '../../setup.ts';
import { setTimeout } from 'node:timers/promises';

describe('useSetupEffect with Switch', () => {
  browserSetup();
  afterAll(() => {
    resetGlobalContext();
  });

  it('works in a Switch() statement', async () => {
    const state = Cell.source<'A' | 'B' | 'C'>('A');
    const setupFn = vi.fn();
    const cleanupFn = vi.fn();

    const ComponentWithEffect = () => {
      useSetupEffect(() => {
        setupFn();
        return () => {
          cleanupFn();
        };
      });
      return <div>Effect Component</div>;
    };

    const App = () => {
      return (
        <div>
          {Switch(state, {
            A: () => <div>Case A</div>,
            B: () => <ComponentWithEffect />,
            C: () => <div>Case C</div>,
          })}
        </div>
      );
    };

    const result = App() as HTMLElement;
    await runPendingSetupEffects();

    expect(getTextContent(result)).toBe('Case A');
    expect(setupFn).not.toHaveBeenCalled();
    expect(cleanupFn).not.toHaveBeenCalled();

    state.set('B');
    await setTimeout();
    expect(getTextContent(result)).toBe('Effect Component');
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();

    state.set('C');
    await setTimeout();
    expect(getTextContent(result)).toBe('Case C');
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    state.set('B');
    await setTimeout();
    expect(getTextContent(result)).toBe('Effect Component');
    expect(setupFn).toHaveBeenCalledTimes(2);
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    state.set('A');
    await setTimeout();
    expect(getTextContent(result)).toBe('Case A');
    expect(setupFn).toHaveBeenCalledTimes(2);
    expect(cleanupFn).toHaveBeenCalledTimes(2);
  });
});
