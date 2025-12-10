import { describe, it, expect, vi } from 'vitest';
import { useSetupEffect, If, Cell, runPendingSetupEffects } from 'retend';
import { getTextContent, browserSetup, timeout } from '../../setup.tsx';

describe('useSetupEffect with If', () => {
  browserSetup();

  it('works in an If() branch', async () => {
    const show = Cell.source(false);
    const setupFn = vi.fn();
    const cleanupFn = vi.fn();

    const ComponentWithEffect = () => {
      useSetupEffect(() => {
        setupFn();
        return () => {
          cleanupFn();
        };
      });
      return <div>Component</div>;
    };

    const App = () => {
      return (
        <div>
          {If(show, () => (
            <ComponentWithEffect />
          ))}
        </div>
      );
    };

    const result = App() as HTMLElement;
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(setupFn).not.toHaveBeenCalled();
    expect(cleanupFn).not.toHaveBeenCalled();
    expect(getTextContent(result)).toBe('');

    show.set(true);
    await timeout();
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();
    expect(getTextContent(result)).toBe('Component');

    show.set(false);
    await timeout();
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
    expect(getTextContent(result)).toBe('');

    show.set(true);
    await timeout();
    expect(setupFn).toHaveBeenCalledTimes(2);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
    expect(getTextContent(result)).toBe('Component');
  });
});
