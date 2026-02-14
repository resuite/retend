import {
  Cell,
  getActiveRenderer,
  If,
  onSetup,
  runPendingSetupEffects,
} from 'retend';
import { describe, expect, it, vi } from 'vitest';
import { browserSetup, timeout } from '../../setup.tsx';

describe('onSetup with async setup functions', () => {
  browserSetup();

  it('should handle async setup functions', async () => {
    const setupFn = vi.fn();
    const asyncOperation = vi.fn().mockResolvedValue('done');
    const renderer = getActiveRenderer();

    const ComponentWithAsyncEffect = () => {
      onSetup(async () => {
        setupFn();
        const result = await asyncOperation();
        expect(result).toBe('done');
        return () => {
          // cleanup
        };
      });
      return <div>Component</div>;
    };

    window.document.body.append(renderer.render(ComponentWithAsyncEffect));
    await runPendingSetupEffects();

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(asyncOperation).toHaveBeenCalledTimes(1);
  });

  it('should handle cleanup after async setup', async () => {
    const cleanupFn = vi.fn();
    const renderer = getActiveRenderer();

    const ComponentWithAsyncCleanup = () => {
      onSetup(async () => {
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

    const result = renderer.render(App) as HTMLElement;
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(cleanupFn).not.toHaveBeenCalled();

    show.set(false);
    await timeout();

    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should handle cleanup after sync setup', async () => {
    const cleanupFn = vi.fn();
    const renderer = getActiveRenderer();

    const ComponentWithSyncCleanup = () => {
      onSetup(() => {
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

    const result = renderer.render(App) as HTMLElement;
    console.log({ result });
    window.document.body.append(result);
    await runPendingSetupEffects();

    expect(cleanupFn).not.toHaveBeenCalled();

    show.set(false);
    await timeout();

    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });
});
