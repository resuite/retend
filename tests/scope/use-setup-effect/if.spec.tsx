import { describe, it, expect, vi, afterAll } from 'vitest';
import { useSetupEffect, If, Cell } from 'retend';
import { resetGlobalContext } from 'retend/context';
import { getTextContent, browserSetup } from '../../setup.ts';

describe('useSetupEffect with If', () => {
  browserSetup();
  afterAll(() => {
    resetGlobalContext();
  });

  it('works in an If() branch', () => {
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

    expect(setupFn).not.toHaveBeenCalled();
    expect(cleanupFn).not.toHaveBeenCalled();
    expect(getTextContent(result)).toBe('');

    show.set(true);
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();
    expect(getTextContent(result)).toBe('Component');

    show.set(false);
    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
    expect(getTextContent(result)).toBe('');

    show.set(true);
    expect(setupFn).toHaveBeenCalledTimes(2);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
    expect(getTextContent(result)).toBe('Component');
  });
});
