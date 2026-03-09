import {
  Await,
  Cell,
  getActiveRenderer,
  onSetup,
  runPendingSetupEffects,
} from 'retend';
import { describe, expect, it, vi } from 'vitest';

import { browserSetup, getTextContent, timeout } from '../../setup.tsx';

describe('onSetup with Await', () => {
  browserSetup();

  it('runs setup only after Await resolves', async () => {
    const setupFn = vi.fn();

    const Child = () => {
      const asyncText = Cell.derivedAsync(async () => {
        await timeout(30);
        return 'Ready';
      });

      onSetup(() => {
        setupFn();
      });

      return <span>{asyncText}</span>;
    };

    const App = () => (
      <div>
        <Await fallback={<span>Loading</span>}>
          <Child />
        </Await>
      </div>
    );

    const renderer = getActiveRenderer();
    const result = renderer.render(App) as HTMLElement;
    window.document.body.append(result);

    await runPendingSetupEffects();

    expect(getTextContent(result)).toBe('Loading');
    expect(setupFn).not.toHaveBeenCalled();

    await timeout(40);

    expect(getTextContent(result)).toBe('Ready');
    expect(setupFn).toHaveBeenCalledTimes(1);
  });

  it('registers cleanup only after Await resolves', async () => {
    const cleanupFn = vi.fn();
    const setupFn = vi.fn(() => cleanupFn);

    const Child = () => {
      const asyncText = Cell.derivedAsync(async () => {
        await timeout(30);
        return 'Ready';
      });

      onSetup(setupFn);

      return <span>{asyncText}</span>;
    };

    const App = () => (
      <div>
        <Await fallback={<span>Loading</span>}>
          <Child />
        </Await>
      </div>
    );

    const renderer = getActiveRenderer();
    const result = renderer.render(App) as HTMLElement;
    window.document.body.append(result);

    await runPendingSetupEffects();

    expect(setupFn).not.toHaveBeenCalled();
    expect(cleanupFn).not.toHaveBeenCalled();

    await timeout(40);

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).not.toHaveBeenCalled();
  });
});
