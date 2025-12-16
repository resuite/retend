import { describe, it, expect, vi } from 'vitest';
import { useSetupEffect, If, Cell, runPendingSetupEffects } from 'retend';
import { browserSetup, timeout } from '../../setup.tsx';

describe('useSetupEffect with async setup functions', () => {
  browserSetup();

  it('should handle async setup functions', async () => {
    const setupFn = vi.fn();
    const asyncOperation = vi.fn().mockResolvedValue('done');

    const ComponentWithAsyncEffect = () => {
      useSetupEffect(async () => {
        setupFn();
        const result = await asyncOperation();
        expect(result).toBe('done');
        return () => {
          // cleanup
        };
      });
      return <div>Component</div>;
    };

    const App = () => <ComponentWithAsyncEffect />;

    const result = App() as HTMLElement;
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(asyncOperation).toHaveBeenCalledTimes(1);
  });

  it('should handle cleanup after async setup', async () => {
    const cleanupFn = vi.fn();

    const ComponentWithAsyncCleanup = () => {
      useSetupEffect(async () => {
        await timeout(10);
        return () => {
          cleanupFn();
        };
      });
      return <div>Component</div>;
    };

    const show = Cell.source(true);

    const App = () => {
      return (
        <div>
          {If(
            show,
            () => (
              <ComponentWithAsyncCleanup />
            ),
            () => (
              <div>Empty</div>
            )
          )}
        </div>
      );
    };

    const result = App() as HTMLElement;
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(cleanupFn).not.toHaveBeenCalled();

    show.set(false);
    await timeout();

    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should handle cleanup after sync setup', async () => {
    const cleanupFn = vi.fn();

    const ComponentWithSyncCleanup = () => {
      useSetupEffect(() => {
        return () => {
          cleanupFn();
        };
      });
      return <div>Component</div>;
    };

    const show = Cell.source(true);

    const App = () => {
      return (
        <div>
          {If(
            show,
            () => (
              <ComponentWithSyncCleanup />
            ),
            () => (
              <div>Empty</div>
            )
          )}
        </div>
      );
    };

    const result = App() as HTMLElement;
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(cleanupFn).not.toHaveBeenCalled();

    show.set(false);
    await timeout();

    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });
});
